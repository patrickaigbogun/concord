package crypto

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type KeyManager struct {
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
	KeyID      string
	Issuer     string
}

type UserClaims struct {
	UserID      string `json:"sub"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	DisplayName string `json:"name"`
	AvatarURL   string `json:"picture,omitempty"`
	jwt.RegisteredClaims
}

type JWK struct {
	Kty string `json:"kty"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type JWKSResponse struct {
	Keys []JWK `json:"keys"`
}

func NewKeyManager(keyDir string, issuer string) (*KeyManager, error) {
	if err := os.MkdirAll(keyDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create key dir: %w", err)
	}

	privPath := filepath.Join(keyDir, "id_rsa.pem")
	var privKey *rsa.PrivateKey

	if _, err := os.Stat(privPath); os.IsNotExist(err) {
		// Generate new RSA 2048 key
		key, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return nil, fmt.Errorf("failed to generate rsa key: %w", err)
		}
		privKey = key

		// Save to disk
		privBytes := x509.MarshalPKCS1PrivateKey(privKey)
		pemBlock := &pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: privBytes,
		}
		if err := os.WriteFile(privPath, pem.EncodeToMemory(pemBlock), 0600); err != nil {
			return nil, fmt.Errorf("failed to save private key: %w", err)
		}
	} else {
		// Load existing key
		pemBytes, err := os.ReadFile(privPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read private key: %w", err)
		}
		block, _ := pem.Decode(pemBytes)
		if block == nil {
			return nil, fmt.Errorf("invalid pem block")
		}
		key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse rsa private key: %w", err)
		}
		privKey = key
	}

	pubKey := &privKey.PublicKey

	// Generate deterministic Key ID based on public key hash
	pubASN1, _ := x509.MarshalPKIXPublicKey(pubKey)
	hash := sha256.Sum256(pubASN1)
	kid := fmt.Sprintf("concord-key-%x", hash[:8])

	return &KeyManager{
		PrivateKey: privKey,
		PublicKey:  pubKey,
		KeyID:      kid,
		Issuer:     issuer,
	}, nil
}

func (km *KeyManager) SignToken(claims UserClaims, duration time.Duration) (string, error) {
	now := time.Now().UTC()
	claims.Issuer = km.Issuer
	claims.IssuedAt = jwt.NewNumericDate(now)
	claims.ExpiresAt = jwt.NewNumericDate(now.Add(duration))

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = km.KeyID

	return token.SignedString(km.PrivateKey)
}

func (km *KeyManager) ParseAndVerify(tokenStr string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return km.PublicKey, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}

func (km *KeyManager) GetJWKS() JWKSResponse {
	nBytes := km.PublicKey.N.Bytes()
	eInt := big.NewInt(int64(km.PublicKey.E))
	eBytes := eInt.Bytes()

	jwk := JWK{
		Kty: "RSA",
		Use: "sig",
		Alg: "RS256",
		Kid: km.KeyID,
		N:   base64.RawURLEncoding.EncodeToString(nBytes),
		E:   base64.RawURLEncoding.EncodeToString(eBytes),
	}

	return JWKSResponse{
		Keys: []JWK{jwk},
	}
}
