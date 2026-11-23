package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"
)

type RouteConfig struct {
	IDServiceURL      string
	StorageServiceURL string
	ChatServiceURL    string
}

type Gateway struct {
	idProxy      *httputil.ReverseProxy
	storageProxy *httputil.ReverseProxy
	chatProxy    *httputil.ReverseProxy
	config       RouteConfig
}

func main() {
	port := flag.String("port", getEnv("PORT", "8080"), "Port for Gateway to listen on")
	idURL := flag.String("id-url", getEnv("ID_SERVICE_URL", "http://localhost:4001"), "Concord ID internal URL")
	storageURL := flag.String("storage-url", getEnv("STORAGE_SERVICE_URL", "http://localhost:4002"), "Concord Storage internal URL")
	chatURL := flag.String("chat-url", getEnv("CHAT_SERVICE_URL", "http://localhost:4000"), "Concord Chat API internal URL")
	flag.Parse()

	cfg := RouteConfig{
		IDServiceURL:      *idURL,
		StorageServiceURL: *storageURL,
		ChatServiceURL:    *chatURL,
	}

	gateway, err := NewGateway(cfg)
	if err != nil {
		log.Fatalf("Fatal: Failed to initialize gateway: %v", err)
	}

	addr := fmt.Sprintf(":%s", *port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      gateway.Handler(),
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("🛡️  Concord API Gateway listening on %s", addr)
	log.Printf("   • [ID Provider] -> %s  (handles /oauth/*, /.well-known/*, /api/v1/auth/*)", cfg.IDServiceURL)
	log.Printf("   • [Storage]     -> %s  (handles /upload, /files/*)", cfg.StorageServiceURL)
	log.Printf("   • [Chat & Core] -> %s  (handles /api/v1/spaces/*, /realms/*, /posts/*)", cfg.ChatServiceURL)
	log.Printf("   • [Health Check] -> %s/health", addr)

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Fatal: Gateway server error: %v", err)
	}
}

func NewGateway(cfg RouteConfig) (*Gateway, error) {
	uID, err := url.Parse(cfg.IDServiceURL)
	if err != nil {
		return nil, fmt.Errorf("invalid ID service url: %w", err)
	}
	uStorage, err := url.Parse(cfg.StorageServiceURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Storage service url: %w", err)
	}
	uChat, err := url.Parse(cfg.ChatServiceURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Chat service url: %w", err)
	}

	return &Gateway{
		idProxy:      createProxy(uID),
		storageProxy: createProxy(uStorage),
		chatProxy:    createProxy(uChat),
		config:       cfg,
	}, nil
}

func createProxy(target *url.URL) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Preserve incoming host and protocol headers
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
		req.Header.Set("X-Forwarded-Proto", "http")
		if req.TLS != nil {
			req.Header.Set("X-Forwarded-Proto", "https")
		}
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("❌ Gateway proxy error for %s %s -> %v", r.Method, r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "bad_gateway",
			"message": "Internal upstream service unavailable",
		})
	}

	return proxy
}

func (g *Gateway) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Global CORS handling
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id, X-Space-Id")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		path := r.URL.Path

		// Health Check
		if path == "/health" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"status":  "ok",
				"service": "concord-gateway",
				"time":    time.Now().UTC(),
			})
			return
		}

		// Routing Rules
		// 1. Auth & OIDC Identity routes -> concord-id
		if strings.HasPrefix(path, "/oauth/") ||
			strings.HasPrefix(path, "/.well-known/") ||
			strings.HasPrefix(path, "/api/v1/auth/") ||
			strings.HasPrefix(path, "/api/v1/oauth/") {
			g.idProxy.ServeHTTP(w, r)
			logRequest("ID", r.Method, path, start)
			return
		}

		// 2. Chat & Core API routes -> concord-chat
		if strings.HasPrefix(path, "/api/") ||
			strings.HasPrefix(path, "/socket/") ||
			strings.HasPrefix(path, "/swagger") ||
			path == "/openapi.json" {
			g.chatProxy.ServeHTTP(w, r)
			logRequest("CHAT", r.Method, path, start)
			return
		}

		// Default 404
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "route_not_found",
			"message": "No backend service matches this path",
		})
	})
}

func logRequest(service, method, path string, start time.Time) {
	duration := time.Since(start)
	log.Printf("[%s] %s %s - %v", service, method, path, duration)
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
