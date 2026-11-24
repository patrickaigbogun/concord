package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type ServiceRouteConfig struct {
	ServiceID    string   `json:"service_id"`
	Prefixes     []string `json:"prefixes"`
	TargetURL    string   `json:"target_url"`
	AuthMode     string   `json:"auth_mode"`      // "public" | "optional" | "required"
	RateLimitRPM int      `json:"rate_limit_rpm"` // requests per minute
	HealthPath   string   `json:"health_path"`
}

type RoutesFile struct {
	Services []ServiceRouteConfig `json:"services"`
}

type compiledRoute struct {
	cfg     ServiceRouteConfig
	proxy   *httputil.ReverseProxy
	healthy atomic.Bool
}

type RoutingTable struct {
	routes []*compiledRoute
}

type verifiedIdentity struct {
	UserID      string
	Username    string
	DisplayName string
	Email       string
	AvatarURL   string
	ExpiresAt   time.Time
}

// Bounded token-bucket rate limiter with automatic stale eviction
type rateBucket struct {
	tokens     float64
	lastRefill time.Time
	lastSeen   time.Time
}

type RateLimiter struct {
	mu         sync.Mutex
	buckets    map[string]*rateBucket
	maxEntries int
}

func NewRateLimiter(maxEntries int) *RateLimiter {
	rl := &RateLimiter{
		buckets:    make(map[string]*rateBucket),
		maxEntries: maxEntries,
	}
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			rl.sweep()
		}
	}()
	return rl
}

func (rl *RateLimiter) Allow(key string, rpm int) (bool, int) {
	if rpm <= 0 {
		return true, 0
	}
	now := time.Now()
	ratePerSec := float64(rpm) / 60.0
	burst := float64(rpm)
	if burst < 5 {
		burst = 5
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[key]
	if !ok {
		if len(rl.buckets) >= rl.maxEntries {
			rl.evictOldestLocked()
		}
		b = &rateBucket{tokens: burst - 1, lastRefill: now, lastSeen: now}
		rl.buckets[key] = b
		return true, 0
	}

	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens = math.Min(burst, b.tokens+elapsed*ratePerSec)
	b.lastRefill = now
	b.lastSeen = now

	if b.tokens < 1.0 {
		retryAfter := int(math.Ceil((1.0 - b.tokens) / ratePerSec))
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, retryAfter
	}

	b.tokens -= 1.0
	return true, 0
}

func (rl *RateLimiter) sweep() {
	cutoff := time.Now().Add(-5 * time.Minute)
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for k, b := range rl.buckets {
		if b.lastSeen.Before(cutoff) {
			delete(rl.buckets, k)
		}
	}
}

func (rl *RateLimiter) evictOldestLocked() {
	cutoff := time.Now().Add(-2 * time.Minute)
	removed := 0
	for k, b := range rl.buckets {
		if b.lastSeen.Before(cutoff) {
			delete(rl.buckets, k)
			removed++
		}
	}
	if removed == 0 {
		// Hard cap fallback: drop ~10% of map to guarantee bounded memory
		target := rl.maxEntries / 10
		for k := range rl.buckets {
			delete(rl.buckets, k)
			removed++
			if removed >= target {
				break
			}
		}
	}
}

type GatewayConfig struct {
	Port          string
	IDServiceURL  string
	ChatURL       string
	RoutesFile    string
	GatewaySecret string
	GatewayDomain string
	MaxWSPerKey   int
}

type Gateway struct {
	cfg        GatewayConfig
	table      atomic.Pointer[RoutingTable]
	httpClient *http.Client
	authCache  sync.Map
	authCount  atomic.Int64
	limiter    *RateLimiter
	wsMu       sync.Mutex
	wsCounts   map[string]int
}

func main() {
	port := flag.String("port", getEnv("PORT", "8080"), "Port for Gateway to listen on")
	idURL := flag.String("id-url", getEnv("ID_SERVICE_URL", "https://id.dexx.systems"), "Concord ID URL")
	chatURL := flag.String("chat-url", getEnv("CHAT_SERVICE_URL", "https://chat.concord.dexx.systems"), "Concord Chat URL")
	routesFile := flag.String("routes-file", getEnv("GATEWAY_ROUTES_FILE", ""), "Path to JSON routing table config")
	gatewaySecret := flag.String("gateway-secret", getEnv("GATEWAY_SHARED_SECRET", ""), "Shared HMAC secret for Gateway-only backend authentication")
	gatewayDomain := flag.String("domain", getEnv("GATEWAY_DOMAIN", "gateway.concord.dexx.systems"), "Public domain of the Gateway")
	flag.Parse()

	cfg := GatewayConfig{
		Port:          *port,
		IDServiceURL:  strings.TrimRight(*idURL, "/"),
		ChatURL:       strings.TrimRight(*chatURL, "/"),
		RoutesFile:    *routesFile,
		GatewaySecret: *gatewaySecret,
		GatewayDomain: *gatewayDomain,
		MaxWSPerKey:   5,
	}

	gw, err := NewGateway(cfg)
	if err != nil {
		log.Fatalf("Fatal: Failed to initialize gateway: %v", err)
	}

	// Support zero-downtime hot reload of routing table via SIGHUP
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGHUP)
	go func() {
		for range sigs {
			if err := gw.reloadRoutes(); err != nil {
				log.Printf("⚠️  Failed to reload routes on SIGHUP: %v", err)
			} else {
				log.Printf("✓ Reloaded gateway routing table via SIGHUP")
			}
		}
	}()

	// Background health checker (every 15s) and auth cache eviction (every 2m)
	go gw.runHealthChecks()
	go gw.runAuthCacheEviction()

	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           gw.Handler(),
		ReadHeaderTimeout: 15 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	log.Printf("🛡️  Concord API Gateway listening on %s (%s)", addr, cfg.GatewayDomain)
	if cfg.GatewaySecret != "" {
		log.Printf("   • HMAC Gateway Signing: ENABLED (30s replay window)")
	} else {
		log.Printf("   • HMAC Gateway Signing: DISABLED (set GATEWAY_SHARED_SECRET)")
	}

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Fatal: Gateway server error: %v", err)
	}
}

func NewGateway(cfg GatewayConfig) (*Gateway, error) {
	gw := &Gateway{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 5 * time.Second},
		limiter:    NewRateLimiter(50000),
		wsCounts:   make(map[string]int),
	}
	if err := gw.reloadRoutes(); err != nil {
		return nil, err
	}
	return gw, nil
}

func (g *Gateway) defaultRoutes() []ServiceRouteConfig {
	return []ServiceRouteConfig{
		{
			ServiceID:    "id",
			Prefixes:     []string{"/oauth/", "/.well-known/", "/api/v1/auth/", "/api/v1/oauth/"},
			TargetURL:    g.cfg.IDServiceURL,
			AuthMode:     "public",
			RateLimitRPM: 60,
			HealthPath:   "/health",
		},
		{
			ServiceID:    "chat",
			Prefixes:     []string{"/api/", "/socket/", "/swagger", "/openapi.json"},
			TargetURL:    g.cfg.ChatURL,
			AuthMode:     "optional",
			RateLimitRPM: 180,
			HealthPath:   "/api/openapi.json",
		},
	}
}

func (g *Gateway) reloadRoutes() error {
	var routeCfgs []ServiceRouteConfig

	if g.cfg.RoutesFile != "" {
		raw, err := os.ReadFile(g.cfg.RoutesFile)
		if err != nil {
			return fmt.Errorf("failed reading routes file %s: %w", g.cfg.RoutesFile, err)
		}
		var rf RoutesFile
		if err := json.Unmarshal(raw, &rf); err != nil {
			return fmt.Errorf("failed parsing routes file %s: %w", g.cfg.RoutesFile, err)
		}
		routeCfgs = rf.Services
	} else {
		routeCfgs = g.defaultRoutes()
	}

	compiled := make([]*compiledRoute, 0, len(routeCfgs))
	for _, rc := range routeCfgs {
		target, err := url.Parse(rc.TargetURL)
		if err != nil || (target.Scheme != "http" && target.Scheme != "https") {
			return fmt.Errorf("invalid target_url for service %s: %q", rc.ServiceID, rc.TargetURL)
		}
		// Sort prefixes longest-first for deterministic matching
		sort.Slice(rc.Prefixes, func(i, j int) bool {
			return len(rc.Prefixes[i]) > len(rc.Prefixes[j])
		})
		cr := &compiledRoute{
			cfg:   rc,
			proxy: createProxy(target),
		}
		cr.healthy.Store(true)
		compiled = append(compiled, cr)
		log.Printf("   • Route [%s] %v -> %s (auth=%s, rpm=%d)", rc.ServiceID, rc.Prefixes, rc.TargetURL, rc.AuthMode, rc.RateLimitRPM)
	}

	g.table.Store(&RoutingTable{routes: compiled})
	return nil
}

func (g *Gateway) matchRoute(path string) *compiledRoute {
	tbl := g.table.Load()
	if tbl == nil {
		return nil
	}
	var best *compiledRoute
	bestLen := 0
	for _, cr := range tbl.routes {
		for _, prefix := range cr.cfg.Prefixes {
			if strings.HasPrefix(path, prefix) && len(prefix) > bestLen {
				best = cr
				bestLen = len(prefix)
			}
		}
	}
	return best
}

func createProxy(target *url.URL) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
		if req.Header.Get("X-Forwarded-Proto") == "" {
			if req.TLS != nil {
				req.Header.Set("X-Forwarded-Proto", "https")
			} else {
				req.Header.Set("X-Forwarded-Proto", "http")
			}
		}
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("❌ Gateway proxy error [%s] %s %s -> %v", r.Header.Get("X-Request-Id"), r.Method, r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":      "bad_gateway",
			"message":    "Upstream service unavailable",
			"request_id": r.Header.Get("X-Request-Id"),
		})
	}

	return proxy
}

func computeGatewaySignature(secret, timestamp, method, path, userID string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	payload := fmt.Sprintf("%s:%s:%s:%s", timestamp, strings.ToUpper(method), path, userID)
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func (g *Gateway) signRequest(r *http.Request, userID string) {
	if g.cfg.GatewaySecret == "" {
		return
	}
	ts := strconv.FormatInt(time.Now().UTC().Unix(), 10)
	sig := computeGatewaySignature(g.cfg.GatewaySecret, ts, r.Method, r.URL.Path, userID)
	r.Header.Set("X-Gateway-Timestamp", ts)
	r.Header.Set("X-Gateway-Signature", sig)
}

// handleVerifyGateway is called by Traefik ForwardAuth on internal service subdomains (e.g. chat.concord.dexx.systems)
// to cryptographically guarantee every request originated from concord-gateway within a 30-second window.
func (g *Gateway) handleVerifyGateway(w http.ResponseWriter, r *http.Request) {
	if g.cfg.GatewaySecret == "" {
		w.WriteHeader(http.StatusOK)
		return
	}

	tsStr := strings.TrimSpace(r.Header.Get("X-Gateway-Timestamp"))
	sig := strings.TrimSpace(r.Header.Get("X-Gateway-Signature"))
	userID := strings.TrimSpace(r.Header.Get("X-User-Id"))
	fwdMethod := strings.TrimSpace(r.Header.Get("X-Forwarded-Method"))
	fwdURI := strings.TrimSpace(r.Header.Get("X-Forwarded-Uri"))

	if tsStr == "" || sig == "" || fwdMethod == "" || fwdURI == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "forbidden",
			"message": "Direct access is blocked; route requests through gateway.concord.dexx.systems",
		})
		return
	}

	ts, err := strconv.ParseInt(tsStr, 10, 64)
	if err != nil {
		w.WriteHeader(http.StatusForbidden)
		return
	}

	now := time.Now().UTC().Unix()
	if now-ts > 30 || ts-now > 30 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "forbidden",
			"message": "Gateway signature expired",
		})
		return
	}

	// Strip query string from X-Forwarded-Uri to match r.URL.Path signed by the Gateway
	pathOnly := fwdURI
	if idx := strings.IndexByte(pathOnly, '?'); idx != -1 {
		pathOnly = pathOnly[:idx]
	}

	expected := computeGatewaySignature(g.cfg.GatewaySecret, tsStr, fwdMethod, pathOnly, userID)
	if !hmac.Equal([]byte(expected), []byte(sig)) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "forbidden",
			"message": "Invalid gateway signature",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
}

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
		g.authCount.Add(-1)
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, g.cfg.IDServiceURL+"/oauth/userinfo", nil)
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
	if g.authCount.Load() < 50000 {
		if _, loaded := g.authCache.LoadOrStore(cacheKey, identity); !loaded {
			g.authCount.Add(1)
		}
	}
	return &identity, nil
}

func (g *Gateway) runAuthCacheEviction() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		g.authCache.Range(func(k, v interface{}) bool {
			if cached, ok := v.(verifiedIdentity); ok && now.After(cached.ExpiresAt) {
				g.authCache.Delete(k)
				g.authCount.Add(-1)
			}
			return true
		})
	}
}

func (g *Gateway) runHealthChecks() {
	check := func() {
		tbl := g.table.Load()
		if tbl == nil {
			return
		}
		for _, cr := range tbl.routes {
			if cr.cfg.HealthPath == "" {
				continue
			}
			checkURL := strings.TrimRight(cr.cfg.TargetURL, "/") + cr.cfg.HealthPath
			req, err := http.NewRequest(http.MethodGet, checkURL, nil)
			if err != nil {
				continue
			}
			g.signRequest(req, "")
			resp, err := g.httpClient.Do(req)
			if err != nil {
				cr.healthy.Store(false)
				continue
			}
			_, _ = ioCopyDiscard(resp)
			cr.healthy.Store(resp.StatusCode < 500)
		}
	}

	check()
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		check()
	}
}

func ioCopyDiscard(resp *http.Response) (int64, error) {
	defer resp.Body.Close()
	buf := make([]byte, 512)
	n, _ := resp.Body.Read(buf)
	return int64(n), nil
}

func clientIP(r *http.Request) string {
	// Prefer X-Real-IP set by Traefik; fall back to RemoteAddr (never trust arbitrary client X-Forwarded-For chains)
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

func generateRequestID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return "req_" + hex.EncodeToString(b)
}

func (g *Gateway) acquireWS(key string) bool {
	g.wsMu.Lock()
	defer g.wsMu.Unlock()
	if g.wsCounts[key] >= g.cfg.MaxWSPerKey {
		return false
	}
	g.wsCounts[key]++
	return true
}

func (g *Gateway) releaseWS(key string) {
	g.wsMu.Lock()
	defer g.wsMu.Unlock()
	if g.wsCounts[key] > 1 {
		g.wsCounts[key]--
	} else {
		delete(g.wsCounts, key)
	}
}

func (g *Gateway) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		path := r.URL.Path

		// Internal Traefik ForwardAuth endpoint (verify Gateway HMAC signature)
		if path == "/internal/verify-gateway" {
			g.handleVerifyGateway(w, r)
			return
		}

		// Attach trace ID
		reqID := strings.TrimSpace(r.Header.Get("X-Request-Id"))
		if reqID == "" {
			reqID = generateRequestID()
		}
		r.Header.Set("X-Request-Id", reqID)
		w.Header().Set("X-Request-Id", reqID)

		// Global CORS handling
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Space-Id, X-Request-Id")
		w.Header().Set("Access-Control-Expose-Headers", "X-Request-Id, Retry-After")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Gateway Health Check + downstream routing table status
		if path == "/health" {
			services := map[string]string{}
			if tbl := g.table.Load(); tbl != nil {
				for _, cr := range tbl.routes {
					if cr.healthy.Load() {
						services[cr.cfg.ServiceID] = "up"
					} else {
						services[cr.cfg.ServiceID] = "down"
					}
				}
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"status":   "ok",
				"service":  "concord-gateway",
				"domain":   g.cfg.GatewayDomain,
				"services": services,
				"time":     time.Now().UTC(),
			})
			return
		}

		route := g.matchRoute(path)
		if route == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":      "route_not_found",
				"message":    "No backend service matches this path",
				"request_id": reqID,
			})
			return
		}

		// Always strip untrusted client identity & gateway signature headers
		r.Header.Del("X-User-Id")
		r.Header.Del("X-Username")
		r.Header.Del("X-Display-Name")
		r.Header.Del("X-Email")
		r.Header.Del("X-Avatar-Url")
		r.Header.Del("X-Gateway-Secret")
		r.Header.Del("X-Gateway-Timestamp")
		r.Header.Del("X-Gateway-Signature")

		// Verify Bearer token if route isn't strictly public
		userID := ""
		if route.cfg.AuthMode != "public" {
			id, err := g.resolveIdentity(r)
			if err == nil && id != nil {
				userID = id.UserID
				r.Header.Set("X-User-Id", id.UserID)
				r.Header.Set("X-Username", id.Username)
				r.Header.Set("X-Display-Name", id.DisplayName)
				r.Header.Set("X-Email", id.Email)
				r.Header.Set("X-Avatar-Url", id.AvatarURL)
			} else if route.cfg.AuthMode == "required" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error":      "unauthorized",
					"message":    "Valid Concord ID Bearer token required",
					"request_id": reqID,
				})
				return
			}
		}

		// Per-User (if authenticated) or Per-IP rate limiting
		ip := clientIP(r)
		limitKey := route.cfg.ServiceID + ":ip:" + ip
		rpm := route.cfg.RateLimitRPM
		if userID != "" {
			limitKey = route.cfg.ServiceID + ":user:" + userID
		} else if rpm > 60 {
			rpm = 60 // tighter ceiling for unauthenticated IPs
		}

		if allowed, retryAfter := g.limiter.Allow(limitKey, rpm); !allowed {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":       "rate_limit_exceeded",
				"message":     "Too many requests, please slow down",
				"retry_after": retryAfter,
				"request_id":  reqID,
			})
			return
		}

		// Concurrent WebSocket cap
		isWS := strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
		if isWS {
			wsKey := "ip:" + ip
			if userID != "" {
				wsKey = "user:" + userID
			}
			if !g.acquireWS(wsKey) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error":      "too_many_websockets",
					"message":    "Maximum concurrent WebSocket connections reached",
					"request_id": reqID,
				})
				return
			}
			defer g.releaseWS(wsKey)
		}

		// Fail fast if health check marked this remote service down
		if !route.healthy.Load() {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":      "service_unavailable",
				"message":    fmt.Sprintf("Service '%s' is currently unavailable", route.cfg.ServiceID),
				"request_id": reqID,
			})
			return
		}

		// Sign proxied request with HMAC + timestamp so Traefik/backend knows it came from Gateway
		g.signRequest(r, userID)

		route.proxy.ServeHTTP(w, r)
		log.Printf("[%s] [%s] %s %s - %v", strings.ToUpper(route.cfg.ServiceID), reqID, r.Method, path, time.Since(start))
	})
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
