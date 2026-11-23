package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

type Database struct {
	*sql.DB
}

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	DisplayName  string    `json:"display_name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	AvatarURL    string    `json:"avatar_url"`
	Bio          string    `json:"bio"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type OAuthClient struct {
	ClientID     string    `json:"client_id"`
	ClientSecret string    `json:"client_secret,omitempty"`
	Name         string    `json:"name"`
	RedirectURIs string    `json:"redirect_uris"` // comma-separated
	IsPublic     bool      `json:"is_public"`
	CreatedAt    time.Time `json:"created_at"`
}

type AuthCode struct {
	Code                string
	ClientID            string
	UserID              string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	ExpiresAt           time.Time
	Used                bool
}

func InitDB(dbPath string) (*Database, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	// Enable WAL mode for high concurrency
	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_busy_timeout=5000", dbPath)
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		display_name TEXT NOT NULL,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		avatar_url TEXT DEFAULT '',
		bio TEXT DEFAULT '',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

	CREATE TABLE IF NOT EXISTS oauth_clients (
		client_id TEXT PRIMARY KEY,
		client_secret TEXT NOT NULL,
		name TEXT NOT NULL,
		redirect_uris TEXT NOT NULL,
		is_public BOOLEAN DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS auth_codes (
		code TEXT PRIMARY KEY,
		client_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		redirect_uri TEXT NOT NULL,
		code_challenge TEXT DEFAULT '',
		code_challenge_method TEXT DEFAULT '',
		expires_at TIMESTAMP NOT NULL,
		used BOOLEAN DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS refresh_tokens (
		token TEXT PRIMARY KEY,
		client_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		expires_at TIMESTAMP NOT NULL,
		revoked BOOLEAN DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		expires_at TIMESTAMP NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS login_tokens (
		token TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		token_type TEXT NOT NULL,
		expires_at TIMESTAMP NOT NULL,
		used BOOLEAN DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_login_tokens_user ON login_tokens(user_id);
	`

	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &Database{db}, nil
}

func (d *Database) CreateUser(username, displayName, email, password string) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &User{
		ID:           uuid.New().String(),
		Username:     username,
		DisplayName:  displayName,
		Email:        email,
		PasswordHash: string(hash),
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	query := `INSERT INTO users (id, username, display_name, email, password_hash, created_at, updated_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err = d.Exec(query, user.ID, user.Username, user.DisplayName, user.Email, user.PasswordHash, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (d *Database) Authenticate(login, password string) (*User, error) {
	var user User
	query := `SELECT id, username, display_name, email, password_hash, avatar_url, bio, created_at, updated_at 
	          FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`
	err := d.QueryRow(query, login, login).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Email,
		&user.PasswordHash, &user.AvatarURL, &user.Bio,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	return &user, nil
}

func (d *Database) GetUserByID(id string) (*User, error) {
	var user User
	query := `SELECT id, username, display_name, email, avatar_url, bio, created_at, updated_at 
	          FROM users WHERE id = ?`
	err := d.QueryRow(query, id).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Email,
		&user.AvatarURL, &user.Bio,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (d *Database) UpdateUserProfile(id string, displayName, avatarURL, bio *string) (*User, error) {
	user, err := d.GetUserByID(id)
	if err != nil {
		return nil, err
	}

	if displayName != nil && *displayName != "" {
		user.DisplayName = *displayName
	}
	if avatarURL != nil {
		user.AvatarURL = *avatarURL
	}
	if bio != nil {
		user.Bio = *bio
	}
	user.UpdatedAt = time.Now().UTC()

	query := `UPDATE users SET display_name = ?, avatar_url = ?, bio = ?, updated_at = ? WHERE id = ?`
	_, err = d.Exec(query, user.DisplayName, user.AvatarURL, user.Bio, user.UpdatedAt, user.ID)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (d *Database) CreateClient(name, redirectURIs string, isPublic bool) (*OAuthClient, error) {
	clientID := "concord_" + uuid.New().String()[:12]
	clientSecret := ""
	if !isPublic {
		clientSecret = uuid.New().String() + uuid.New().String()
	}

	client := &OAuthClient{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Name:         name,
		RedirectURIs: redirectURIs,
		IsPublic:     isPublic,
		CreatedAt:    time.Now().UTC(),
	}

	query := `INSERT INTO oauth_clients (client_id, client_secret, name, redirect_uris, is_public, created_at)
	          VALUES (?, ?, ?, ?, ?, ?)`
	_, err := d.Exec(query, client.ClientID, client.ClientSecret, client.Name, client.RedirectURIs, client.IsPublic, client.CreatedAt)
	if err != nil {
		return nil, err
	}
	return client, nil
}

func (d *Database) GetClient(clientID string) (*OAuthClient, error) {
	var client OAuthClient
	query := `SELECT client_id, client_secret, name, redirect_uris, is_public, created_at FROM oauth_clients WHERE client_id = ?`
	err := d.QueryRow(query, clientID).Scan(
		&client.ClientID, &client.ClientSecret, &client.Name, &client.RedirectURIs, &client.IsPublic, &client.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &client, nil
}

func (d *Database) SaveAuthCode(code, clientID, userID, redirectURI, codeChallenge, method string, duration time.Duration) error {
	expiresAt := time.Now().UTC().Add(duration)
	query := `INSERT INTO auth_codes (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := d.Exec(query, code, clientID, userID, redirectURI, codeChallenge, method, expiresAt)
	return err
}

func (d *Database) ConsumeAuthCode(code, clientID string) (*AuthCode, error) {
	var ac AuthCode
	query := `SELECT code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at, used
	          FROM auth_codes WHERE code = ? AND client_id = ?`
	err := d.QueryRow(query, code, clientID).Scan(
		&ac.Code, &ac.ClientID, &ac.UserID, &ac.RedirectURI, &ac.CodeChallenge, &ac.CodeChallengeMethod, &ac.ExpiresAt, &ac.Used,
	)
	if err != nil {
		return nil, fmt.Errorf("invalid code")
	}

	if ac.Used {
		return nil, fmt.Errorf("code already used")
	}

	if time.Now().UTC().After(ac.ExpiresAt) {
		return nil, fmt.Errorf("code expired")
	}

	// Mark as used
	_, _ = d.Exec("UPDATE auth_codes SET used = 1 WHERE code = ?", code)
	return &ac, nil
}

func (d *Database) SaveRefreshToken(token, clientID, userID string, duration time.Duration) error {
	expiresAt := time.Now().UTC().Add(duration)
	query := `INSERT INTO refresh_tokens (token, client_id, user_id, expires_at) VALUES (?, ?, ?, ?)`
	_, err := d.Exec(query, token, clientID, userID, expiresAt)
	return err
}

func (d *Database) ValidateRefreshToken(token, clientID string) (string, error) {
	var userID string
	var expiresAt time.Time
	var revoked bool
	query := `SELECT user_id, expires_at, revoked FROM refresh_tokens WHERE token = ? AND client_id = ?`
	err := d.QueryRow(query, token, clientID).Scan(&userID, &expiresAt, &revoked)
	if err != nil {
		return "", fmt.Errorf("invalid refresh token")
	}
	if revoked {
		return "", fmt.Errorf("token revoked")
	}
	if time.Now().UTC().After(expiresAt) {
		return "", fmt.Errorf("token expired")
	}
	return userID, nil
}

func (d *Database) CreateSession(userID string, duration time.Duration) (string, error) {
	sessionID := "sess_" + uuid.New().String()
	expiresAt := time.Now().UTC().Add(duration)
	query := `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
	_, err := d.Exec(query, sessionID, userID, expiresAt)
	if err != nil {
		return "", err
	}
	return sessionID, nil
}

func (d *Database) RefreshOrCreateSession(existingSessionID, userID string, duration time.Duration) (string, error) {
	if existingSessionID != "" {
		var existingUserID string
		var expiresAt time.Time
		err := d.QueryRow(`SELECT user_id, expires_at FROM sessions WHERE id = ?`, existingSessionID).Scan(&existingUserID, &expiresAt)
		if err == nil {
			if existingUserID == userID && time.Now().UTC().Before(expiresAt) {
				newExpiry := time.Now().UTC().Add(duration)
				_, _ = d.Exec(`UPDATE sessions SET expires_at = ? WHERE id = ?`, newExpiry, existingSessionID)
				return existingSessionID, nil
			}
			_, _ = d.Exec(`DELETE FROM sessions WHERE id = ?`, existingSessionID)
		}
	}
	return d.CreateSession(userID, duration)
}

func (d *Database) GetSessionUser(sessionID string) (*User, error) {
	var userID string
	var expiresAt time.Time
	query := `SELECT user_id, expires_at FROM sessions WHERE id = ?`
	err := d.QueryRow(query, sessionID).Scan(&userID, &expiresAt)
	if err != nil {
		return nil, fmt.Errorf("session not found")
	}

	if time.Now().UTC().After(expiresAt) {
		_, _ = d.Exec("DELETE FROM sessions WHERE id = ?", sessionID)
		return nil, fmt.Errorf("session expired")
	}

	return d.GetUserByID(userID)
}

func (d *Database) DeleteSession(sessionID string) error {
	_, err := d.Exec("DELETE FROM sessions WHERE id = ?", sessionID)
	return err
}

func (d *Database) DeleteSessionsByUserID(userID string) error {
	_, err := d.Exec("DELETE FROM sessions WHERE user_id = ?", userID)
	return err
}

func (d *Database) GetActiveSessionsCount(userID string) int {
	var count int
	_ = d.QueryRow("SELECT COUNT(*) FROM sessions WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP", userID).Scan(&count)
	return count
}

func (d *Database) GetUserByEmailOrUsername(identifier string) (*User, error) {
	var user User
	query := `SELECT id, username, display_name, email, password_hash, avatar_url, bio, created_at, updated_at 
	          FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`
	err := d.QueryRow(query, identifier, identifier).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Email,
		&user.PasswordHash, &user.AvatarURL, &user.Bio,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}
	return &user, nil
}

func (d *Database) CreateToken(userID, tokenType string, duration time.Duration) (string, error) {
	token := "tok_" + uuid.New().String()
	expiresAt := time.Now().UTC().Add(duration)
	query := `INSERT INTO login_tokens (token, user_id, token_type, expires_at) VALUES (?, ?, ?, ?)`
	_, err := d.Exec(query, token, userID, tokenType, expiresAt)
	if err != nil {
		return "", err
	}
	return token, nil
}

func (d *Database) ValidateToken(token, tokenType string) (*User, error) {
	var userID string
	var expiresAt time.Time
	var used bool
	query := `SELECT user_id, expires_at, used FROM login_tokens WHERE token = ? AND token_type = ?`
	err := d.QueryRow(query, token, tokenType).Scan(&userID, &expiresAt, &used)
	if err != nil {
		return nil, fmt.Errorf("invalid or expired link")
	}
	if used {
		return nil, fmt.Errorf("link has already been used")
	}
	if time.Now().UTC().After(expiresAt) {
		return nil, fmt.Errorf("link has expired")
	}
	return d.GetUserByID(userID)
}

func (d *Database) ConsumeToken(token, tokenType string) (*User, error) {
	user, err := d.ValidateToken(token, tokenType)
	if err != nil {
		return nil, err
	}
	_, _ = d.Exec("UPDATE login_tokens SET used = 1 WHERE token = ?", token)
	return user, nil
}

func (d *Database) UpdatePassword(userID, newPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = d.Exec("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", string(hash), userID)
	return err
}

func (d *Database) ChangePassword(userID, oldPassword, newPassword string) error {
	var hash string
	err := d.QueryRow("SELECT password_hash FROM users WHERE id = ?", userID).Scan(&hash)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(oldPassword)); err != nil {
		return fmt.Errorf("current password is incorrect")
	}

	return d.UpdatePassword(userID, newPassword)
}

