package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"concord-id/internal/crypto"
	"concord-id/internal/db"
	"concord-id/internal/server"
)

func main() {
	port := flag.String("port", getEnv("PORT", "4001"), "HTTP port to listen on")
	dbPath := flag.String("db", getEnv("DB_PATH", "./data/id.db"), "Path to SQLite database")
	keyDir := flag.String("keys", getEnv("KEY_DIR", "./keys"), "Directory to store/load RSA keys")
	issuer := flag.String("issuer", getEnv("ISSUER", "http://localhost:4001"), "OAuth2 / OIDC Issuer URL")
	flag.Parse()

	log.Println("⚡ Initializing Concord ID service...")

	// Initialize RSA Key Manager
	keyManager, err := crypto.NewKeyManager(*keyDir, *issuer)
	if err != nil {
		log.Fatalf("Fatal: Failed to initialize key manager: %v", err)
	}
	log.Printf("✓ Cryptographic Key ID: %s", keyManager.KeyID)

	// Initialize Database
	database, err := db.InitDB(*dbPath)
	if err != nil {
		log.Fatalf("Fatal: Failed to initialize database: %v", err)
	}
	log.Printf("✓ Database initialized at: %s", *dbPath)

	// Seed default Concord client if none exists
	seedDefaultClients(database)

	// Create Server
	srv, err := server.NewServer(database, keyManager, *issuer)
	if err != nil {
		log.Fatalf("Fatal: Failed to initialize server: %v", err)
	}

	addr := fmt.Sprintf(":%s", *port)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      srv.Routes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("🚀 Concord ID listening on %s (Issuer: %s)", addr, *issuer)
	log.Printf("   • Discovery: %s/.well-known/openid-configuration", *issuer)
	log.Printf("   • JWKS:      %s/.well-known/jwks.json", *issuer)
	log.Printf("   • Authorize: %s/oauth/authorize", *issuer)
	log.Printf("   • Token:     %s/oauth/token", *issuer)

	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Fatal: Server error: %v", err)
	}
}

func seedDefaultClients(d *db.Database) {
	// 1. Default Concord Web App client (Public client with PKCE)
	if _, err := d.GetClient("concord_web"); err != nil {
		query := `INSERT OR IGNORE INTO oauth_clients (client_id, client_secret, name, redirect_uris, is_public, created_at)
		          VALUES ('concord_web', '', 'Concord Web', 'http://localhost:3000/auth/callback,https://concord.chat/auth/callback', 1, CURRENT_TIMESTAMP)`
		_, _ = d.Exec(query)
		log.Println("✓ Default client 'concord_web' registered")
	}

	// 2. CouchPotato / CP Agent client (OAuth 2.1 client)
	if _, err := d.GetClient("cp_agent"); err != nil {
		query := `INSERT OR IGNORE INTO oauth_clients (client_id, client_secret, name, redirect_uris, is_public, created_at)
		          VALUES ('cp_agent', 'cp_secret_default_change_in_prod', 'CouchPotato Agent', 'http://localhost:3000/callback,http://localhost:8000/callback,https://couchpotato.dexx.systems/callback', 1, CURRENT_TIMESTAMP)`
		_, _ = d.Exec(query)
		log.Println("✓ Default client 'cp_agent' registered for CouchPotato")
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
