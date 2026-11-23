package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

type RouteConfig struct {
	IDServiceURL   string
	ChatServiceURL string
}

type verifiedIdentity struct {
	UserID      string
	Username    string
	DisplayName string
	Email       string
	AvatarURL   string
	ExpiresAt   time.Time
}

type Gateway struct {
	idProxy    *httputil.ReverseProxy
	chatProxy  *httputil.ReverseProxy
	config     RouteConfig
	httpClient *http.Client
	authCache  sync.Map
}

func main() {
	port := flag.String("port", getEnv("PORT", "8080"), "Port for Gateway to listen on")
	idURL := flag.String("id-url", getEnv("ID_SERVICE_URL", "http://127.0.0.1:4001"), "Concord ID internal URL")
	chatURL := flag.String("chat-url", getEnv("CHAT_SERVICE_URL", "http://127.0.0.1:4000"), "Concord Chat API internal URL")
	flag.Parse()

	cfg := RouteConfig{
		IDServiceURL:   strings.TrimRight(*idURL, "/"),
		ChatServiceURL: strings.TrimRight(*chatURL, "/"),
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

	log.Printf("🛡️  Concord API Gateway listening on %s (gateway.concord.dexx.systems)", addr)
	log.Printf("   • [ID Provider] -> %s  (handles /oauth/*, /.well-known/*, /api/v1/auth/*)", cfg.IDServiceURL)
	log.Printf("   • [Chat & WS]   -> %s  (handles /api/*, /socket/*, /swagger, /openapi.json)", cfg.ChatServiceURL)
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
	uChat, err := url.Parse(cfg.ChatServiceURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Chat service url: %w", err)
	}

	return &Gateway{
		idProxy:    createProxy(uID),
		chatProxy:  createProxy(uChat),
		config:     cfg,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}, nil
}

func createProxy(target *url.URL) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
		if req.Header.Get("X-Forwarded-Proto") == "" {
			if req.TLS != nil {
				req.Header.Set("X-Forwarded-Proto", "https")
			} else {
				req.Header.Set("X-Forwarded-Proto", "http")
			}
		}
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("❌ Gateway proxy error for %s %s -> %v", r.Method, r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "bad_gateway",
			"message": "Upstream service unavailable",
		})
	}

	return proxy
}

// resolveIdentity verifies a Concord ID Bearer token and returns verified user claims
func (g *Gateway) resolveIdentity(r *http.Request) (*verifiedIdentity, error) {
	token := ""
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(authHeader, "Bearer ") {
		token = strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	} else if qToken := r.URL.Query().Get("token"); qToken != "" {
		token = strings.TrimSpace(qToken)
	}

	if token == "" {
		return nil, nil
	}

	hash := sha256.Sum256([]byte(token))
	cacheKey := hex.EncodeToString(hash[:])
	if val, ok := g.authCache.Load(cacheKey); ok {
		cached := val.(verifiedIdentity)
		if time.Now().Before(cached.ExpiresAt) {
			return &cached, nil
		}
		g.authCache.Delete(cacheKey)
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, g.config.IDServiceURL+"/oauth/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid token")
	}

	var payload struct {
		Sub               string `json:"sub"`
		PreferredUsername string `json:"preferred_username"`
		Name              string `json:"name"`
		Email             string `json:"email"`
		Picture           string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil || payload.Sub == "" {
		return nil, fmt.Errorf("invalid userinfo response")
	}

	identity := verifiedIdentity{
		UserID:      payload.Sub,
		Username:    payload.PreferredUsername,
		DisplayName: payload.Name,
		Email:       payload.Email,
		AvatarURL:   payload.Picture,
		ExpiresAt:   time.Now().Add(60 * time.Second),
	}
	g.authCache.Store(cacheKey, identity)
	return &identity, nil
}

func (g *Gateway) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Global CORS handling
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Space-Id")
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
				"domain":  "gateway.concord.dexx.systems",
				"time":    time.Now().UTC(),
			})
			return
		}

		// 1. Auth & OIDC Identity routes -> concord-id
		if strings.HasPrefix(path, "/oauth/") ||
			strings.HasPrefix(path, "/.well-known/") ||
			strings.HasPrefix(path, "/api/v1/auth/") ||
			strings.HasPrefix(path, "/api/v1/oauth/") {
			g.idProxy.ServeHTTP(w, r)
			logRequest("ID", r.Method, path, start)
			return
		}

		// 2. Chat & Core API + Realtime WebSockets -> concord-chat
		if strings.HasPrefix(path, "/api/") ||
			strings.HasPrefix(path, "/socket/") ||
			strings.HasPrefix(path, "/swagger") ||
			path == "/openapi.json" {

			// Always strip untrusted client identity headers to prevent spoofing
			r.Header.Del("X-User-Id")
			r.Header.Del("X-Username")
			r.Header.Del("X-Display-Name")
			r.Header.Del("X-Email")
			r.Header.Del("X-Avatar-Url")

			// If Bearer token is present, verify against Concord ID and inject verified headers
			if id, err := g.resolveIdentity(r); err == nil && id != nil {
				r.Header.Set("X-User-Id", id.UserID)
				r.Header.Set("X-Username", id.Username)
				r.Header.Set("X-Display-Name", id.DisplayName)
				r.Header.Set("X-Email", id.Email)
				r.Header.Set("X-Avatar-Url", id.AvatarURL)
			}

			g.chatProxy.ServeHTTP(w, r)
			logRequest("CHAT", r.Method, path, start)
			return
		}

		// Default 404 (Storage is exclusively on https://r2.concord.dexx.systems)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "route_not_found",
			"message": "No backend service matches this path on gateway.concord.dexx.systems",
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
