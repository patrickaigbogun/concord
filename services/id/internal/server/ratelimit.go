package server

import (
	"encoding/json"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type ipBucket struct {
	tokens     float64
	lastRefill time.Time
	lastSeen   time.Time
}

type RateLimiter struct {
	mu         sync.Mutex
	buckets    map[string]*ipBucket
	maxEntries int
}

func NewRateLimiter(maxEntries int) *RateLimiter {
	rl := &RateLimiter{
		buckets:    make(map[string]*ipBucket),
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

func (rl *RateLimiter) Allow(key string, rpm int, burst float64) (bool, int) {
	now := time.Now()
	ratePerSec := float64(rpm) / 60.0

	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[key]
	if !ok {
		if len(rl.buckets) >= rl.maxEntries {
			cutoff := now.Add(-2 * time.Minute)
			for k, v := range rl.buckets {
				if v.lastSeen.Before(cutoff) {
					delete(rl.buckets, k)
				}
			}
		}
		b = &ipBucket{tokens: burst - 1, lastRefill: now, lastSeen: now}
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

func extractClientIP(r *http.Request) string {
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

func (s *Server) withAuthRateLimit(scope string, rpm int, burst float64, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			key := scope + ":" + extractClientIP(r)
			if allowed, retryAfter := s.Limiter.Allow(key, rpm, burst); !allowed {
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				if strings.HasPrefix(r.URL.Path, "/api/") {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusTooManyRequests)
					_ = json.NewEncoder(w).Encode(map[string]interface{}{
						"error":       "rate_limit_exceeded",
						"message":     "Too many attempts, please wait before trying again",
						"retry_after": retryAfter,
					})
					return
				}
				http.Error(w, "Too many attempts. Please wait a minute and try again.", http.StatusTooManyRequests)
				return
			}
		}
		next(w, r)
	}
}
