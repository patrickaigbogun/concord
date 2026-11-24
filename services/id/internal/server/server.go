package server

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"concord-id/internal/crypto"
	"concord-id/internal/db"
	"concord-id/internal/email"
	"concord-id/internal/ui"

	"github.com/google/uuid"
)

type Server struct {
	DB          *db.Database
	Keys        *crypto.KeyManager
	Issuer      string
	Mailer      *email.Mailer
	Limiter     *RateLimiter
	loginTmpl   *template.Template
	docsTmpl    *template.Template
	profileTmpl *template.Template
	forgotTmpl  *template.Template
	resetTmpl   *template.Template
}

func NewServer(database *db.Database, keys *crypto.KeyManager, issuer string) (*Server, error) {
	tmpl, err := template.New("login").Parse(ui.LoginTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse login template: %w", err)
	}

	docsTmpl, err := template.New("docs").Parse(ui.DocsTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse docs template: %w", err)
	}

	profileTmpl, err := template.New("profile").Parse(ui.ProfileTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse profile template: %w", err)
	}

	forgotTmpl, err := template.New("forgot").Parse(ui.ForgotPasswordTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse forgot password template: %w", err)
	}

	resetTmpl, err := template.New("reset").Parse(ui.ResetPasswordTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse reset password template: %w", err)
	}

	return &Server{
		DB:          database,
		Keys:        keys,
		Issuer:      issuer,
		Mailer:      email.NewMailer(issuer),
		Limiter:     NewRateLimiter(25000),
		loginTmpl:   tmpl,
		docsTmpl:    docsTmpl,
		profileTmpl: profileTmpl,
		forgotTmpl:  forgotTmpl,
		resetTmpl:   resetTmpl,
	}, nil
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	// CORS & Security wrapper
	withCORS := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}
			next(w, r)
		}
	}

	// OIDC Discovery & Keys
	mux.HandleFunc("/.well-known/openid-configuration", withCORS(s.handleDiscovery))
	mux.HandleFunc("/.well-known/jwks.json", withCORS(s.handleJWKS))

	// OAuth2 Standard Endpoints
	mux.HandleFunc("/oauth/authorize", s.withAuthRateLimit("auth", 10, 12, s.handleAuthorize))
	mux.HandleFunc("/oauth/token", withCORS(s.handleToken))
	mux.HandleFunc("/oauth/userinfo", withCORS(s.handleUserInfo))

	// Direct Auth APIs (First-party)
	mux.HandleFunc("/api/v1/auth/register", withCORS(s.withAuthRateLimit("register", 5, 6, s.handleRegister)))
	mux.HandleFunc("/api/v1/auth/login", withCORS(s.withAuthRateLimit("login", 10, 12, s.handleLogin)))
	mux.HandleFunc("/api/v1/auth/me", withCORS(s.handleMe))

	// Client App Registration (RFC 7591 & Custom)
	mux.HandleFunc("/api/v1/oauth/clients", withCORS(s.handleCreateClient))
	mux.HandleFunc("/oauth/register", withCORS(s.handleCreateClient))

	// Documentation
	mux.HandleFunc("/docs", s.handleDocs)
	mux.HandleFunc("/docs/", s.handleDocs)

	// Web Interface, Profile Management & Recovery
	mux.HandleFunc("/", s.handleRoot)
	mux.HandleFunc("/profile", s.handleProfile)
	mux.HandleFunc("/account", s.handleProfile)
	mux.HandleFunc("/send-magic-link", s.withAuthRateLimit("email", 5, 5, s.handleSendMagicLink))
	mux.HandleFunc("/magic-login", s.handleMagicLogin)
	mux.HandleFunc("/forgot-password", s.withAuthRateLimit("email", 5, 5, s.handleForgotPassword))
	mux.HandleFunc("/reset-password", s.withAuthRateLimit("reset", 5, 6, s.handleResetPassword))
	mux.HandleFunc("/logout", s.handleLogout)

	// Embedded Brand Logo (Storage & Avatars live exclusively on r2.concord.dexx.systems)
	mux.HandleFunc("/logo.png", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write(ui.LogoPNG)
	})

	// Health Check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "concord-id"})
	})

	return mux
}

func (s *Server) handleDocs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	data := map[string]string{
		"Issuer": s.Issuer,
	}
	_ = s.docsTmpl.Execute(w, data)
}

func (s *Server) handleDiscovery(w http.ResponseWriter, r *http.Request) {
	config := map[string]interface{}{
		"issuer":                                s.Issuer,
		"authorization_endpoint":                s.Issuer + "/oauth/authorize",
		"token_endpoint":                        s.Issuer + "/oauth/token",
		"userinfo_endpoint":                     s.Issuer + "/oauth/userinfo",
		"registration_endpoint":                 s.Issuer + "/oauth/register",
		"jwks_uri":                              s.Issuer + "/.well-known/jwks.json",
		"response_types_supported":              []string{"code"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"scopes_supported":                      []string{"openid", "profile", "email"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post", "none"},
		"claims_supported":                      []string{"sub", "iss", "name", "preferred_username", "email", "picture"},
		"code_challenge_methods_supported":      []string{"S256", "plain"},
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(config)
}

func (s *Server) handleJWKS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_ = json.NewEncoder(w).Encode(s.Keys.GetJWKS())
}

type LoginViewData struct {
	ClientID            string
	ClientName          string
	RedirectURI         string
	ResponseType        string
	State               string
	CodeChallenge       string
	CodeChallengeMethod string
	Error               string
	ActiveUser          *db.User
	IsActiveSession     bool
}

func (s *Server) handleAuthorize(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		clientID := r.URL.Query().Get("client_id")
		redirectURI := r.URL.Query().Get("redirect_uri")
		responseType := r.URL.Query().Get("response_type")
		state := r.URL.Query().Get("state")
		codeChallenge := r.URL.Query().Get("code_challenge")
		codeChallengeMethod := r.URL.Query().Get("code_challenge_method")
		prompt := r.URL.Query().Get("prompt")

		if clientID == "" && redirectURI == "" {
			clientID = "concord_id"
			redirectURI = "/profile"
		} else if clientID == "" || redirectURI == "" {
			http.Error(w, "Missing client_id or redirect_uri", http.StatusBadRequest)
			return
		}

		clientName := ""
		if clientID != "concord_id" {
			clientName = "Application"
			if client, err := s.DB.GetClient(clientID); err == nil && client != nil {
				clientName = client.Name
			}
		}

		data := LoginViewData{
			ClientID:            clientID,
			ClientName:          clientName,
			RedirectURI:         redirectURI,
			ResponseType:        responseType,
			State:               state,
			CodeChallenge:       codeChallenge,
			CodeChallengeMethod: codeChallengeMethod,
		}

		// Check active session cookie for 1-click SSO
		if prompt != "login" {
			if cookie, err := r.Cookie("concord_session"); err == nil && cookie.Value != "" {
				if user, err := s.DB.GetSessionUser(cookie.Value); err == nil && user != nil {
					if clientID == "concord_id" || redirectURI == "/profile" || redirectURI == s.Issuer+"/profile" {
						http.Redirect(w, r, "/profile", http.StatusFound)
						return
					}
					data.ActiveUser = user
					data.IsActiveSession = true
				}
			}
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = s.loginTmpl.Execute(w, data)
		return
	}

	if r.Method == http.MethodPost {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "Invalid form data", http.StatusBadRequest)
			return
		}

		action := r.FormValue("action")
		clientID := r.FormValue("client_id")
		redirectURI := r.FormValue("redirect_uri")
		state := r.FormValue("state")
		codeChallenge := r.FormValue("code_challenge")
		codeChallengeMethod := r.FormValue("code_challenge_method")

		if clientID == "" {
			clientID = "concord_id"
		}
		if redirectURI == "" {
			redirectURI = "/profile"
		}

		clientName := ""
		if clientID != "concord_id" {
			clientName = "Application"
			if client, _ := s.DB.GetClient(clientID); client != nil {
				clientName = client.Name
			}
		}

		var user *db.User
		var authErr string

		if action == "consent" {
			// 1-Click Instant SSO Consent
			if cookie, err := r.Cookie("concord_session"); err == nil && cookie.Value != "" {
				sessionUser, err := s.DB.GetSessionUser(cookie.Value)
				if err != nil || sessionUser == nil {
					authErr = "Session expired, please sign in again"
				} else {
					user = sessionUser
				}
			} else {
				authErr = "No active session found"
			}
		} else if action == "register" {
			username := strings.TrimSpace(r.FormValue("username"))
			displayName := strings.TrimSpace(r.FormValue("display_name"))
			email := strings.TrimSpace(r.FormValue("email"))
			password := r.FormValue("password")

			if username == "" || email == "" || password == "" {
				authErr = "All fields are required"
			} else {
				if displayName == "" {
					displayName = username
				}
				createdUser, err := s.DB.CreateUser(username, displayName, email, password)
				if err != nil {
					authErr = "Username or email is already taken"
				} else {
					user = createdUser
					go s.Mailer.SendWelcomeEmail(createdUser.Email, createdUser.DisplayName, createdUser.Username, s.Issuer+"/profile")
				}
			}
		} else {
			// Login
			login := strings.TrimSpace(r.FormValue("login"))
			password := r.FormValue("password")

			authedUser, err := s.DB.Authenticate(login, password)
			if err != nil {
				authErr = "Invalid username or password"
			} else {
				user = authedUser
			}
		}

		if authErr != "" || user == nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusUnauthorized)
			_ = s.loginTmpl.Execute(w, LoginViewData{
				ClientID:            clientID,
				ClientName:          clientName,
				RedirectURI:         redirectURI,
				State:               state,
				CodeChallenge:       codeChallenge,
				CodeChallengeMethod: codeChallengeMethod,
				Error:               authErr,
			})
			return
		}

		// Persist or refresh SSO session cookie (valid 30 days)
		existingSessionID := ""
		if cookie, err := r.Cookie("concord_session"); err == nil {
			existingSessionID = cookie.Value
		}
		if sessID, err := s.DB.RefreshOrCreateSession(existingSessionID, user.ID, 30*24*time.Hour); err == nil {
			http.SetCookie(w, &http.Cookie{
				Name:     "concord_session",
				Value:    sessID,
				Path:     "/",
				MaxAge:   30 * 24 * 3600,
				HttpOnly: true,
				Secure:   true,
				SameSite: http.SameSiteLaxMode,
			})
		}

		// Direct first-party profile login: redirect straight to /profile without OAuth code
		if clientID == "concord_id" || redirectURI == "/profile" || redirectURI == s.Issuer+"/profile" {
			http.Redirect(w, r, "/profile", http.StatusFound)
			return
		}

		// Generate auth code (valid 5 minutes)
		code := "code_" + uuid.New().String()
		err := s.DB.SaveAuthCode(code, clientID, user.ID, redirectURI, codeChallenge, codeChallengeMethod, 5*time.Minute)
		if err != nil {
			http.Error(w, "Failed to issue auth code", http.StatusInternalServerError)
			return
		}

		// Redirect user back with code & state
		redirectURL, err := url.Parse(redirectURI)
		if err != nil {
			http.Error(w, "Invalid redirect_uri", http.StatusBadRequest)
			return
		}

		q := redirectURL.Query()
		q.Set("code", code)
		if state != "" {
			q.Set("state", state)
		}
		redirectURL.RawQuery = q.Encode()

		http.Redirect(w, r, redirectURL.String(), http.StatusFound)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	_ = r.ParseForm()
	grantType := r.FormValue("grant_type")
	clientID := r.FormValue("client_id")
	clientSecret := r.FormValue("client_secret")

	// Also check Basic Auth header
	if u, p, ok := r.BasicAuth(); ok {
		clientID = u
		clientSecret = p
	}

	// Validate client if secret is provided or required
	if client, err := s.DB.GetClient(clientID); err == nil && client != nil {
		if !client.IsPublic && client.ClientSecret != "" && client.ClientSecret != clientSecret {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_client", "error_description": "invalid client credentials"})
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")

	switch grantType {
	case "authorization_code":
		code := r.FormValue("code")
		codeVerifier := r.FormValue("code_verifier")

		authCode, err := s.DB.ConsumeAuthCode(code, clientID)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_grant", "error_description": err.Error()})
			return
		}

		// Validate PKCE if challenge was set
		if authCode.CodeChallenge != "" {
			if codeVerifier == "" {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_request", "error_description": "missing code_verifier"})
				return
			}

			if authCode.CodeChallengeMethod == "S256" {
				h := sha256.Sum256([]byte(codeVerifier))
				calculated := base64.RawURLEncoding.EncodeToString(h[:])
				if calculated != authCode.CodeChallenge {
					w.WriteHeader(http.StatusBadRequest)
					_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_grant", "error_description": "PKCE verification failed"})
					return
				}
			} else {
				// plain
				if codeVerifier != authCode.CodeChallenge {
					w.WriteHeader(http.StatusBadRequest)
					_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_grant", "error_description": "PKCE verification failed"})
					return
				}
			}
		}

		user, err := s.DB.GetUserByID(authCode.UserID)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "server_error", "error_description": "user not found"})
			return
		}

		// Issue JWT Access Token (valid 24h)
		claims := crypto.UserClaims{
			UserID:      user.ID,
			Username:    user.Username,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
		}
		accessToken, err := s.Keys.SignToken(claims, 24*time.Hour)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "server_error", "error_description": "token signing failed"})
			return
		}

		// Issue Refresh Token (valid 30 days)
		refreshToken := "rt_" + uuid.New().String()
		_ = s.DB.SaveRefreshToken(refreshToken, clientID, user.ID, 30*24*time.Hour)

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token":  accessToken,
			"token_type":    "Bearer",
			"expires_in":    86400,
			"refresh_token": refreshToken,
			"scope":         "openid profile email",
			"user": map[string]string{
				"id":           user.ID,
				"username":     user.Username,
				"display_name": user.DisplayName,
				"email":        user.Email,
				"avatar_url":   user.AvatarURL,
			},
		})

	case "refresh_token":
		refreshToken := r.FormValue("refresh_token")
		userID, err := s.DB.ValidateRefreshToken(refreshToken, clientID)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_grant", "error_description": err.Error()})
			return
		}

		user, err := s.DB.GetUserByID(userID)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "server_error"})
			return
		}

		claims := crypto.UserClaims{
			UserID:      user.ID,
			Username:    user.Username,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
		}
		newAccessToken, _ := s.Keys.SignToken(claims, 24*time.Hour)

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": accessTokenOrEmpty(newAccessToken),
			"token_type":   "Bearer",
			"expires_in":   86400,
		})

	default:
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "unsupported_grant_type"})
	}
}

func accessTokenOrEmpty(token string) string {
	return token
}

func (s *Server) handleUserInfo(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := s.Keys.ParseAndVerify(tokenStr)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	user, err := s.DB.GetUserByID(claims.UserID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"sub":                user.ID,
		"preferred_username": user.Username,
		"name":               user.DisplayName,
		"email":              user.Email,
		"picture":            user.AvatarURL,
		"bio":                user.Bio,
	})
}

type RegisterRequest struct {
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid json", http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}
	if req.DisplayName == "" {
		req.DisplayName = req.Username
	}

	user, err := s.DB.CreateUser(req.Username, req.DisplayName, req.Email, req.Password)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Username or email already exists"})
		return
	}

	go s.Mailer.SendWelcomeEmail(user.Email, user.DisplayName, user.Username, s.Issuer+"/profile")

	claims := crypto.UserClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
	}
	token, _ := s.Keys.SignToken(claims, 7*24*time.Hour)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"user":  user,
		"token": token,
	})
}

type LoginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid json", http.StatusBadRequest)
		return
	}

	user, err := s.DB.Authenticate(req.Login, req.Password)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Invalid username/email or password"})
		return
	}

	claims := crypto.UserClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
	}
	token, _ := s.Keys.SignToken(claims, 7*24*time.Hour)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"user":  user,
		"token": token,
	})
}

type UpdateProfileRequest struct {
	DisplayName *string `json:"display_name,omitempty"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
	Bio         *string `json:"bio,omitempty"`
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		http.Error(w, "Missing or invalid Authorization header", http.StatusUnauthorized)
		return
	}

	claims, err := s.Keys.ParseAndVerify(strings.TrimPrefix(authHeader, "Bearer "))
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	if r.Method == http.MethodGet {
		user, err := s.DB.GetUserByID(claims.UserID)
		if err != nil {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(user)
		return
	}

	if r.Method == http.MethodPatch || r.Method == http.MethodPut {
		var req UpdateProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
			return
		}

		user, err := s.DB.UpdateUserProfile(claims.UserID, req.DisplayName, req.AvatarURL, req.Bio)
		if err != nil {
			http.Error(w, "Failed to update profile", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(user)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

type CreateClientRequest struct {
	Name         string `json:"name"`
	RedirectURIs string `json:"redirect_uris"`
	IsPublic     bool   `json:"is_public"`
}

func (s *Server) handleCreateClient(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid json", http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.RedirectURIs == "" {
		http.Error(w, "Name and redirect_uris are required", http.StatusBadRequest)
		return
	}

	client, err := s.DB.CreateClient(req.Name, req.RedirectURIs, req.IsPublic)
	if err != nil {
		http.Error(w, "Failed to create client", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(client)
}

type ProfileViewData struct {
	User                *db.User
	ActiveSessionsCount int
	Success             string
	Error               string
	MagicLink           string
}

type ForgotPasswordViewData struct {
	Success string
	Error   string
}

type ResetPasswordViewData struct {
	Token string
	Error string
}

func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.Redirect(w, r, "/profile", http.StatusFound)
}

func (s *Server) handleProfile(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("concord_session")
	if err != nil || cookie.Value == "" {
		http.Redirect(w, r, "/oauth/authorize?client_id=concord_id&redirect_uri="+url.QueryEscape(s.Issuer+"/profile"), http.StatusFound)
		return
	}

	user, err := s.DB.GetSessionUser(cookie.Value)
	if err != nil || user == nil {
		http.SetCookie(w, &http.Cookie{Name: "concord_session", Value: "", Path: "/", MaxAge: -1})
		http.Redirect(w, r, "/oauth/authorize?client_id=concord_id&redirect_uri="+url.QueryEscape(s.Issuer+"/profile"), http.StatusFound)
		return
	}

	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		sessionsCount := s.DB.GetActiveSessionsCount(user.ID)
		if sessionsCount == 0 {
			sessionsCount = 1
		}
		data := ProfileViewData{
			User:                user,
			ActiveSessionsCount: sessionsCount,
			Success:             r.URL.Query().Get("msg"),
			Error:               r.URL.Query().Get("err"),
			MagicLink:           r.URL.Query().Get("magic"),
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = s.profileTmpl.Execute(w, data)
		return
	}

	if r.Method == http.MethodPost {
		if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
			_ = r.ParseMultipartForm(5 << 20) // 5MB max
		} else {
			_ = r.ParseForm()
		}
		action := r.FormValue("action")

		if action == "update_profile" {
			displayName := strings.TrimSpace(r.FormValue("display_name"))
			avatarURL := strings.TrimSpace(r.FormValue("avatar_url"))
			bio := strings.TrimSpace(r.FormValue("bio"))

			if file, header, err := r.FormFile("avatar_file"); err == nil && file != nil {
				defer file.Close()
				ext := strings.ToLower(filepath.Ext(header.Filename))
				switch ext {
				case ".jpg", ".jpeg", ".png", ".webp", ".gif":
					uploadedURL, uploadErr := s.uploadToConcordStorage(user, file, header.Filename)
					if uploadErr != nil {
						http.Redirect(w, r, "/profile?err="+url.QueryEscape("Avatar storage upload failed: "+uploadErr.Error()), http.StatusSeeOther)
						return
					}
					avatarURL = uploadedURL
				default:
					http.Redirect(w, r, "/profile?err=Unsupported+image+format+(use+JPG,+PNG,+WebP,+or+GIF)", http.StatusSeeOther)
					return
				}
			}

			_, err := s.DB.UpdateUserProfile(user.ID, &displayName, &avatarURL, &bio)
			if err != nil {
				http.Redirect(w, r, "/profile?err=Failed+to+update+profile", http.StatusSeeOther)
				return
			}
			http.Redirect(w, r, "/profile?msg=Profile+updated+successfully", http.StatusSeeOther)
			return
		}

		if action == "change_password" {
			currentPassword := r.FormValue("current_password")
			newPassword := r.FormValue("new_password")
			confirmPassword := r.FormValue("confirm_password")

			if len(newPassword) < 8 {
				http.Redirect(w, r, "/profile?err=New+password+must+be+at+least+8+characters", http.StatusSeeOther)
				return
			}
			if newPassword != confirmPassword {
				http.Redirect(w, r, "/profile?err=New+passwords+do+not+match", http.StatusSeeOther)
				return
			}

			err := s.DB.ChangePassword(user.ID, currentPassword, newPassword)
			if err != nil {
				http.Redirect(w, r, "/profile?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
				return
			}

			go s.Mailer.SendPasswordChangedEmail(user.Email, user.DisplayName, s.Issuer+"/profile")
			http.Redirect(w, r, "/profile?msg=Password+updated+successfully", http.StatusSeeOther)
			return
		}

		http.Redirect(w, r, "/profile", http.StatusSeeOther)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleSendMagicLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Redirect(w, r, "/profile", http.StatusSeeOther)
		return
	}

	cookie, err := r.Cookie("concord_session")
	if err != nil || cookie.Value == "" {
		http.Redirect(w, r, "/profile", http.StatusSeeOther)
		return
	}

	user, err := s.DB.GetSessionUser(cookie.Value)
	if err != nil || user == nil {
		http.Redirect(w, r, "/profile", http.StatusSeeOther)
		return
	}

	token, err := s.DB.CreateToken(user.ID, "magic_login", 20*time.Minute)
	if err != nil {
		http.Redirect(w, r, "/profile?err=Failed+to+create+login+link", http.StatusSeeOther)
		return
	}

	magicURL := s.Issuer + "/magic-login?token=" + token
	go s.Mailer.SendMagicLoginEmail(user.Email, user.DisplayName, magicURL)

	http.Redirect(w, r, "/profile?msg="+url.QueryEscape("Instant login link sent to "+user.Email+"! Open it on your laptop to sign in.")+"&magic="+url.QueryEscape(magicURL), http.StatusSeeOther)
}

func (s *Server) handleMagicLogin(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Redirect(w, r, "/forgot-password?err=Missing+token", http.StatusSeeOther)
		return
	}

	user, err := s.DB.ConsumeToken(token, "magic_login")
	if err != nil {
		http.Redirect(w, r, "/forgot-password?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}

	// Issue or refresh 30-day SSO session
	existingSessionID := ""
	if cookie, err := r.Cookie("concord_session"); err == nil {
		existingSessionID = cookie.Value
	}
	sessID, err := s.DB.RefreshOrCreateSession(existingSessionID, user.ID, 30*24*time.Hour)
	if err == nil {
		http.SetCookie(w, &http.Cookie{
			Name:     "concord_session",
			Value:    sessID,
			Path:     "/",
			MaxAge:   30 * 24 * 3600,
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteLaxMode,
		})
	}

	http.Redirect(w, r, "/profile?msg="+url.QueryEscape("Welcome back, "+user.DisplayName+"! You are now logged in on this device."), http.StatusSeeOther)
}

func (s *Server) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		data := ForgotPasswordViewData{
			Error:   r.URL.Query().Get("err"),
			Success: r.URL.Query().Get("msg"),
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = s.forgotTmpl.Execute(w, data)
		return
	}

	if r.Method == http.MethodPost {
		_ = r.ParseForm()
		identifier := strings.TrimSpace(r.FormValue("identifier"))
		if identifier == "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = s.forgotTmpl.Execute(w, ForgotPasswordViewData{Error: "Please enter your username or email"})
			return
		}

		user, err := s.DB.GetUserByEmailOrUsername(identifier)
		if err == nil && user != nil {
			token, err := s.DB.CreateToken(user.ID, "reset", 1*time.Hour)
			if err == nil {
				resetURL := s.Issuer + "/reset-password?token=" + token
				go s.Mailer.SendPasswordResetEmail(user.Email, user.DisplayName, resetURL)
			}
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = s.forgotTmpl.Execute(w, ForgotPasswordViewData{
			Success: "If an account matches that username or email, a password reset link has been dispatched to the email on file. Please check your inbox.",
		})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Redirect(w, r, "/forgot-password?err=Missing+reset+token", http.StatusSeeOther)
			return
		}
		if _, err := s.DB.ValidateToken(token, "reset"); err != nil {
			http.Redirect(w, r, "/forgot-password?err="+url.QueryEscape("This password reset link is invalid or has expired. Please request a new one."), http.StatusSeeOther)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = s.resetTmpl.Execute(w, ResetPasswordViewData{Token: token})
		return
	}

	if r.Method == http.MethodPost {
		_ = r.ParseForm()
		token := r.FormValue("token")
		password := r.FormValue("password")
		confirm := r.FormValue("confirm_password")

		if len(password) < 8 {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = s.resetTmpl.Execute(w, ResetPasswordViewData{
				Token: token,
				Error: "Password must be at least 8 characters",
			})
			return
		}

		if password != confirm {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = s.resetTmpl.Execute(w, ResetPasswordViewData{
				Token: token,
				Error: "Passwords do not match",
			})
			return
		}

		user, err := s.DB.ConsumeToken(token, "reset")
		if err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = s.resetTmpl.Execute(w, ResetPasswordViewData{
				Token: token,
				Error: err.Error(),
			})
			return
		}

		if err := s.DB.UpdatePassword(user.ID, password); err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = s.resetTmpl.Execute(w, ResetPasswordViewData{
				Token: token,
				Error: "Failed to update password. Please try again.",
			})
			return
		}

		go s.Mailer.SendPasswordChangedEmail(user.Email, user.DisplayName, s.Issuer+"/profile")

		// Log user in automatically with new or refreshed session
		existingSessionID := ""
		if cookie, err := r.Cookie("concord_session"); err == nil {
			existingSessionID = cookie.Value
		}
		sessID, err := s.DB.RefreshOrCreateSession(existingSessionID, user.ID, 30*24*time.Hour)
		if err == nil {
			http.SetCookie(w, &http.Cookie{
				Name:     "concord_session",
				Value:    sessID,
				Path:     "/",
				MaxAge:   30 * 24 * 3600,
				HttpOnly: true,
				Secure:   true,
				SameSite: http.SameSiteLaxMode,
			})
		}

		http.Redirect(w, r, "/profile?msg="+url.QueryEscape("Your password has been reset successfully!"), http.StatusSeeOther)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, _ := r.Cookie("concord_session")
	all := r.URL.Query().Get("all") == "true" || r.FormValue("all") == "true"

	if cookie != nil && cookie.Value != "" {
		if all {
			if user, err := s.DB.GetSessionUser(cookie.Value); err == nil && user != nil {
				_ = s.DB.DeleteSessionsByUserID(user.ID)
			}
		} else {
			_ = s.DB.DeleteSession(cookie.Value)
		}
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "concord_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, "/oauth/authorize?client_id=concord_id&redirect_uri="+url.QueryEscape(s.Issuer+"/profile"), http.StatusSeeOther)
}

func (s *Server) uploadToConcordStorage(user *db.User, src io.Reader, filename string) (string, error) {
	storageBase := os.Getenv("STORAGE_URL")
	if storageBase == "" {
		storageBase = "https://r2.concord.dexx.systems"
	}
	storageBase = strings.TrimRight(storageBase, "/")

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreateFormFile("file", filepath.Base(filename))
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, io.LimitReader(src, 5<<20)); err != nil {
		return "", err
	}
	_ = mw.Close()

	token, err := s.Keys.SignToken(crypto.UserClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
	}, 5*time.Minute)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, storageBase+"/upload", &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("storage responded with status %d", resp.StatusCode)
	}

	var result struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || result.URL == "" {
		return "", fmt.Errorf("invalid storage response")
	}

	return result.URL, nil
}
