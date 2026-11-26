package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type Config struct {
	Port        string
	StorageDir  string
	PublicURL   string
	ChatAPIURL  string
	IDAPIURL    string
	InternalKey string
	RequireAuth bool
	MaxUploadMB int64

	// S3 Configuration (Works for AWS S3, MinIO, R2, Wasabi, B2)
	S3Enabled   bool
	S3Bucket    string
	S3Region    string
	S3Endpoint  string
	S3AccessKey string
	S3SecretKey string
	S3PathStyle bool

	// Native Cloudflare R2 REST + OAuth Auto-Refresh Configuration
	CFR2Enabled        bool
	CFR2AccountID      string
	CFR2Bucket         string
	CFR2WranglerConfig string
}

type cachedAuthUser struct {
	UserID    string
	Username  string
	ExpiresAt time.Time
}

type uploadBucket struct {
	tokens     float64
	lastRefill time.Time
	lastSeen   time.Time
}

type StorageService struct {
	cfg            Config
	s3Client       *s3.Client
	httpClient     *http.Client
	r2HTTPClient   *http.Client
	r2Mu           sync.Mutex
	r2OAuthToken   string
	r2RefreshToken string
	authCache      sync.Map
	limitMu        sync.Mutex
	uploadBuckets  map[string]*uploadBucket
}

func (svc *StorageService) allowUpload(key string, rpm int, burst float64) (bool, int) {
	now := time.Now()
	ratePerSec := float64(rpm) / 60.0

	svc.limitMu.Lock()
	defer svc.limitMu.Unlock()

	if svc.uploadBuckets == nil {
		svc.uploadBuckets = make(map[string]*uploadBucket)
	}

	b, ok := svc.uploadBuckets[key]
	if !ok {
		if len(svc.uploadBuckets) >= 25000 {
			cutoff := now.Add(-2 * time.Minute)
			for k, v := range svc.uploadBuckets {
				if v.lastSeen.Before(cutoff) {
					delete(svc.uploadBuckets, k)
				}
			}
		}
		b = &uploadBucket{tokens: burst - 1, lastRefill: now, lastSeen: now}
		svc.uploadBuckets[key] = b
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

type FileAssetResponse struct {
	ID          string                 `json:"id"`
	Filename    string                 `json:"filename"`
	ContentType string                 `json:"content_type"`
	SizeBytes   int64                  `json:"size_bytes"`
	URL         string                 `json:"url"`
	PreviewURL  string                 `json:"preview_url,omitempty"`
	SHA256      string                 `json:"sha256"`
	SpaceID     string                 `json:"space_id,omitempty"`
	UploaderID  string                 `json:"uploader_id,omitempty"`
	Backend     string                 `json:"backend"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
}

func main() {
	port := flag.String("port", getEnv("PORT", "4002"), "HTTP port for storage service")
	storageDir := flag.String("storage-dir", getEnv("STORAGE_DIR", "./data/files"), "Directory for local file storage")
	publicURL := flag.String("public-url", getEnv("PUBLIC_URL", "http://localhost:4002"), "Public base URL")
	chatAPIURL := flag.String("chat-api-url", getEnv("CHAT_API_URL", "http://localhost:4000"), "Phoenix Chat API base URL")
	idAPIURL := flag.String("id-api-url", getEnv("ID_API_URL", "http://127.0.0.1:4001"), "Concord ID base URL for token verification")
	internalKey := flag.String("internal-key", getEnv("STORAGE_INTERNAL_KEY", ""), "Optional internal service key for server-to-server uploads")
	requireAuth := flag.Bool("require-auth", getEnvBool("REQUIRE_AUTH", true), "Require Concord ID Bearer token on /upload")
	maxMB := flag.Int64("max-mb", 500, "Maximum upload size in Megabytes")

	// S3 flags / env vars
	s3Bucket := flag.String("s3-bucket", getEnv("S3_BUCKET", ""), "S3 bucket name (if set, uses S3-compatible backend)")
	s3Region := flag.String("s3-region", getEnv("S3_REGION", "auto"), "S3 region (use 'auto' for Cloudflare R2)")
	s3Endpoint := flag.String("s3-endpoint", getEnv("S3_ENDPOINT", ""), "Custom S3 endpoint (e.g. R2 or MinIO)")
	s3AccessKey := flag.String("s3-access-key", getEnv("S3_ACCESS_KEY_ID", ""), "S3 access key ID")
	s3SecretKey := flag.String("s3-secret-key", getEnv("S3_SECRET_ACCESS_KEY", ""), "S3 secret access key")
	s3PathStyle := flag.Bool("s3-force-path-style", getEnvBool("S3_FORCE_PATH_STYLE", true), "Force path style")

	// Native Cloudflare R2 REST API flags / env vars
	cfR2AccountID := flag.String("cf-r2-account-id", getEnv("CF_R2_ACCOUNT_ID", ""), "Cloudflare Account ID for native R2 REST storage")
	cfR2Bucket := flag.String("cf-r2-bucket", getEnv("CF_R2_BUCKET", ""), "Cloudflare R2 bucket name for native R2 REST storage")
	cfR2WranglerCfg := flag.String("cf-r2-wrangler-config", getEnv("CF_R2_WRANGLER_CONFIG", "/home/ubuntu/.config/.wrangler/config/default.toml"), "Path to Wrangler OAuth config")
	flag.Parse()

	cfg := Config{
		Port:               *port,
		StorageDir:         *storageDir,
		PublicURL:          strings.TrimRight(*publicURL, "/"),
		ChatAPIURL:         strings.TrimRight(*chatAPIURL, "/"),
		IDAPIURL:           strings.TrimRight(*idAPIURL, "/"),
		InternalKey:        *internalKey,
		RequireAuth:        *requireAuth,
		MaxUploadMB:        *maxMB,
		S3Enabled:          *s3Bucket != "",
		S3Bucket:           *s3Bucket,
		S3Region:           *s3Region,
		S3Endpoint:         *s3Endpoint,
		S3AccessKey:        *s3AccessKey,
		S3SecretKey:        *s3SecretKey,
		S3PathStyle:        *s3PathStyle,
		CFR2Enabled:        *cfR2AccountID != "" && *cfR2Bucket != "",
		CFR2AccountID:      *cfR2AccountID,
		CFR2Bucket:         *cfR2Bucket,
		CFR2WranglerConfig: *cfR2WranglerCfg,
	}

	var s3Client *s3.Client
	if cfg.S3Enabled {
		client, err := initS3(cfg)
		if err != nil {
			log.Fatalf("Fatal: Failed to initialize S3 client: %v", err)
		}
		s3Client = client
		log.Printf("✓ S3-Compatible storage initialized (Bucket: %s, Endpoint: %s)", cfg.S3Bucket, cfg.S3Endpoint)
	} else if cfg.CFR2Enabled {
		log.Printf("✓ Cloudflare R2 storage initialized (Bucket: %s, Account: %s)", cfg.CFR2Bucket, cfg.CFR2AccountID)
	} else {
		if err := os.MkdirAll(cfg.StorageDir, 0755); err != nil {
			log.Fatalf("Fatal: Cannot create storage directory: %v", err)
		}
		log.Printf("✓ Local disk storage initialized at: %s", cfg.StorageDir)
	}

	svc := &StorageService{
		cfg:          cfg,
		s3Client:     s3Client,
		httpClient:   &http.Client{Timeout: 5 * time.Second},
		r2HTTPClient: &http.Client{Timeout: 120 * time.Second},
	}

	mux := http.NewServeMux()

	withCORS := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id, X-Space-Id, X-Storage-Key, Range")
			w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, ETag")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}
			next(w, r)
		}
	}

	mux.HandleFunc("/upload", withCORS(svc.handleUpload))
	mux.HandleFunc("/files/", withCORS(svc.handleServeFiles))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		backend := "local"
		if svc.cfg.S3Enabled {
			backend = "s3-compatible"
		} else if svc.cfg.CFR2Enabled {
			backend = "cloudflare-r2"
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":       "ok",
			"service":      "concord-storage",
			"backend":      backend,
			"auth_enabled": svc.cfg.RequireAuth,
		})
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("⚡ Concord Storage listening on %s", addr)
	log.Printf("   • Public URL:   %s", cfg.PublicURL)
	log.Printf("   • Concord ID:   %s (Auth Required: %v)", cfg.IDAPIURL, cfg.RequireAuth)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Fatal: Storage server error: %v", err)
	}
}

func initS3(cfg Config) (*s3.Client, error) {
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if cfg.S3Endpoint != "" {
			return aws.Endpoint{
				PartitionID:       "aws",
				URL:               cfg.S3Endpoint,
				SigningRegion:     cfg.S3Region,
				HostnameImmutable: true,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	opts := []func(*config.LoadOptions) error{
		config.WithRegion(cfg.S3Region),
		config.WithEndpointResolverWithOptions(customResolver),
	}

	if cfg.S3AccessKey != "" && cfg.S3SecretKey != "" {
		opts = append(opts, config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.S3AccessKey, cfg.S3SecretKey, "",
		)))
	}

	awsCfg, err := config.LoadDefaultConfig(context.TODO(), opts...)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.S3PathStyle
	})

	return client, nil
}

// authenticateRequest verifies the caller's Concord ID Bearer JWT (or internal service key)
func (svc *StorageService) authenticateRequest(r *http.Request) (string, error) {
	// 1. Check optional internal service key
	if svc.cfg.InternalKey != "" && r.Header.Get("X-Storage-Key") == svc.cfg.InternalKey {
		uid := r.Header.Get("X-User-Id")
		if uid == "" {
			uid = "system"
		}
		return uid, nil
	}

	// 2. Extract Bearer token
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", fmt.Errorf("missing or invalid Authorization Bearer token")
	}
	token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	if token == "" {
		return "", fmt.Errorf("empty Bearer token")
	}

	// 3. Check short-lived in-memory verification cache (60s TTL)
	tokenHash := sha256.Sum256([]byte(token))
	cacheKey := hex.EncodeToString(tokenHash[:])
	if val, ok := svc.authCache.Load(cacheKey); ok {
		cached := val.(cachedAuthUser)
		if time.Now().Before(cached.ExpiresAt) {
			return cached.UserID, nil
		}
		svc.authCache.Delete(cacheKey)
	}

	// 4. Verify against Concord ID /oauth/userinfo
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, svc.cfg.IDAPIURL+"/oauth/userinfo", nil)
	if err != nil {
		return "", fmt.Errorf("failed to construct auth verification request")
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := svc.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("identity service unreachable")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("invalid or expired Concord ID token")
	}

	var info struct {
		Sub               string `json:"sub"`
		PreferredUsername string `json:"preferred_username"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil || info.Sub == "" {
		return "", fmt.Errorf("failed to decode token claims")
	}

	svc.authCache.Store(cacheKey, cachedAuthUser{
		UserID:    info.Sub,
		Username:  info.PreferredUsername,
		ExpiresAt: time.Now().Add(60 * time.Second),
	})

	return info.Sub, nil
}

func (svc *StorageService) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Authenticate caller via Concord ID
	var verifiedUserID string
	if svc.cfg.RequireAuth {
		uid, err := svc.authenticateRequest(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":             "unauthorized",
				"error_description": err.Error(),
			})
			return
		}
		verifiedUserID = uid

		// Per-user upload rate limit (20 uploads/min, burst 25)
		if allowed, retryAfter := svc.allowUpload("upload:"+verifiedUserID, 20, 25); !allowed {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":       "rate_limit_exceeded",
				"message":     "Upload rate limit exceeded, please wait before uploading again",
				"retry_after": retryAfter,
			})
			return
		}
	}

	r.Body = http.MaxBytesReader(w, r.Body, svc.cfg.MaxUploadMB*1024*1024)

	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, fmt.Sprintf("Upload failed or exceeded size: %v", err), http.StatusBadRequest)
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Missing 'file' form field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	spaceID := r.FormValue("space_id")
	if spaceID == "" {
		spaceID = r.Header.Get("X-Space-Id")
	}

	uploaderID := verifiedUserID
	if uploaderID == "" {
		uploaderID = r.FormValue("user_id")
		if uploaderID == "" {
			uploaderID = r.Header.Get("X-User-Id")
		}
	}

	fileID := uuid.New().String()
	sanitizedFilename := filepath.Base(header.Filename)
	if sanitizedFilename == "." || sanitizedFilename == "/" || sanitizedFilename == "" {
		sanitizedFilename = "upload.bin"
	}

	hasher := sha256.New()

	// Sniff content type using first 512 bytes
	sniffBuf := make([]byte, 512)
	n, err := file.Read(sniffBuf)
	if err != nil && err != io.EOF {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	detectedContentType := http.DetectContentType(sniffBuf[:n])
	clientCT := header.Header.Get("Content-Type")
	if clientCT != "" && clientCT != "application/octet-stream" {
		// Never allow client header to override a script/HTML detection or spoof safe media if sniffed as HTML
		if !strings.HasPrefix(detectedContentType, "text/html") && !strings.HasPrefix(detectedContentType, "text/xml") {
			detectedContentType = clientCT
		}
	}

	var totalBytes int64
	backendUsed := "local"

	if svc.cfg.S3Enabled {
		backendUsed = "s3"
		// Stream upload to a temporary disk file instead of buffering up to 500MB in RAM
		tmpFile, err := os.CreateTemp("", "concord-s3-upload-*")
		if err != nil {
			http.Error(w, "Failed to allocate temporary upload file", http.StatusInternalServerError)
			return
		}
		defer os.Remove(tmpFile.Name())
		defer tmpFile.Close()

		mw := io.MultiWriter(tmpFile, hasher)
		if n > 0 {
			if _, err := mw.Write(sniffBuf[:n]); err != nil {
				http.Error(w, "Failed to write upload buffer", http.StatusInternalServerError)
				return
			}
		}
		written, err := io.Copy(mw, file)
		if err != nil {
			http.Error(w, "Failed to read upload stream", http.StatusInternalServerError)
			return
		}
		totalBytes = int64(n) + written

		if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
			http.Error(w, "Failed to seek temporary file", http.StatusInternalServerError)
			return
		}

		s3Key := fmt.Sprintf("concord/%s/%s", fileID, sanitizedFilename)
		_, err = svc.s3Client.PutObject(r.Context(), &s3.PutObjectInput{
			Bucket:        aws.String(svc.cfg.S3Bucket),
			Key:           aws.String(s3Key),
			Body:          tmpFile,
			ContentLength: aws.Int64(totalBytes),
			ContentType:   aws.String(detectedContentType),
		})
		if err != nil {
			log.Printf("❌ S3 upload error: %v", err)
			http.Error(w, "Failed to store in S3", http.StatusInternalServerError)
			return
		}
	} else if svc.cfg.CFR2Enabled {
		backendUsed = "cloudflare-r2"
		tmpFile, err := os.CreateTemp("", "concord-r2-upload-*")
		if err != nil {
			http.Error(w, "Failed to allocate temporary upload file", http.StatusInternalServerError)
			return
		}
		defer os.Remove(tmpFile.Name())
		defer tmpFile.Close()

		mw := io.MultiWriter(tmpFile, hasher)
		if n > 0 {
			if _, err := mw.Write(sniffBuf[:n]); err != nil {
				http.Error(w, "Failed to write upload buffer", http.StatusInternalServerError)
				return
			}
		}
		written, err := io.Copy(mw, file)
		if err != nil {
			http.Error(w, "Failed to read upload stream", http.StatusInternalServerError)
			return
		}
		totalBytes = int64(n) + written

		r2Key := fmt.Sprintf("concord/%s/%s", fileID, sanitizedFilename)
		if err := svc.putR2Object(r.Context(), r2Key, tmpFile, totalBytes, detectedContentType); err != nil {
			log.Printf("❌ Cloudflare R2 upload error: %v", err)
			http.Error(w, "Failed to store in Cloudflare R2", http.StatusInternalServerError)
			return
		}
	} else {
		// Local disk storage
		fileDir := filepath.Join(svc.cfg.StorageDir, fileID)
		if err := os.MkdirAll(fileDir, 0755); err != nil {
			http.Error(w, "Disk error", http.StatusInternalServerError)
			return
		}

		destPath := filepath.Join(fileDir, sanitizedFilename)
		destFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
		if err != nil {
			http.Error(w, "Disk write error", http.StatusInternalServerError)
			return
		}
		defer destFile.Close()

		mw := io.MultiWriter(destFile, hasher)
		if n > 0 {
			if _, err := mw.Write(sniffBuf[:n]); err != nil {
				http.Error(w, "Disk write error", http.StatusInternalServerError)
				return
			}
		}
		written, err := io.Copy(mw, file)
		if err != nil {
			http.Error(w, "Stream copy error", http.StatusInternalServerError)
			return
		}
		totalBytes = int64(n) + written
	}

	shaHex := hex.EncodeToString(hasher.Sum(nil))
	publicFileURL := fmt.Sprintf("%s/files/%s/%s", svc.cfg.PublicURL, fileID, url.PathEscape(sanitizedFilename))

	resp := FileAssetResponse{
		ID:          fileID,
		Filename:    sanitizedFilename,
		ContentType: detectedContentType,
		SizeBytes:   totalBytes,
		URL:         publicFileURL,
		SHA256:      shaHex,
		SpaceID:     spaceID,
		UploaderID:  uploaderID,
		Backend:     backendUsed,
		CreatedAt:   time.Now().UTC(),
	}

	// Notify Phoenix Chat API in background
	if spaceID != "" && uploaderID != "" && svc.cfg.ChatAPIURL != "" {
		callerAuth := r.Header.Get("Authorization")
		go notifyChatAPI(svc.cfg.ChatAPIURL, spaceID, uploaderID, callerAuth, resp)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(resp)
}

// isUnsafeInlineAsset checks if a file extension or content type could execute scripts in a browser
func isUnsafeInlineAsset(filename, contentType string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".html", ".htm", ".xhtml", ".svg", ".svgz", ".xml", ".js", ".mjs", ".swf":
		return true
	}
	ct := strings.ToLower(contentType)
	if strings.Contains(ct, "text/html") ||
		strings.Contains(ct, "image/svg") ||
		strings.Contains(ct, "application/xhtml") ||
		strings.Contains(ct, "text/xml") ||
		strings.Contains(ct, "application/xml") ||
		strings.Contains(ct, "javascript") {
		return true
	}
	return false
}

func setSecurityAndDispositionHeaders(w http.ResponseWriter, filename, contentType string) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")

	safeName := strings.ReplaceAll(filepath.Base(filename), `"`, "")
	if isUnsafeInlineAsset(safeName, contentType) {
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, safeName))
	}
}

func (svc *StorageService) handleServeFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	pathPart := strings.TrimPrefix(r.URL.Path, "/files/")
	parts := strings.SplitN(pathPart, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	fileID := filepath.Base(parts[0])
	filename := ""
	if len(parts) == 2 {
		if unescaped, err := url.PathUnescape(parts[1]); err == nil {
			filename = filepath.Base(unescaped)
		} else {
			filename = filepath.Base(parts[1])
		}
	}

	if svc.cfg.S3Enabled {
		var s3Key string
		if filename != "" {
			s3Key = fmt.Sprintf("concord/%s/%s", fileID, filename)
		} else {
			// Resolve key by prefix if filename was omitted
			listOut, err := svc.s3Client.ListObjectsV2(r.Context(), &s3.ListObjectsV2Input{
				Bucket:  aws.String(svc.cfg.S3Bucket),
				Prefix:  aws.String(fmt.Sprintf("concord/%s/", fileID)),
				MaxKeys: aws.Int32(1),
			})
			if err != nil || len(listOut.Contents) == 0 || listOut.Contents[0].Key == nil {
				http.NotFound(w, r)
				return
			}
			s3Key = *listOut.Contents[0].Key
			filename = filepath.Base(s3Key)
		}

		getInput := &s3.GetObjectInput{
			Bucket: aws.String(svc.cfg.S3Bucket),
			Key:    aws.String(s3Key),
		}
		rangeHeader := r.Header.Get("Range")
		if rangeHeader != "" {
			getInput.Range = aws.String(rangeHeader)
		}

		out, err := svc.s3Client.GetObject(r.Context(), getInput)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer out.Body.Close()

		contentType := "application/octet-stream"
		if out.ContentType != nil && *out.ContentType != "" {
			contentType = *out.ContentType
		}
		setSecurityAndDispositionHeaders(w, filename, contentType)
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Accept-Ranges", "bytes")

		if out.ETag != nil {
			w.Header().Set("ETag", *out.ETag)
		}
		if out.LastModified != nil {
			w.Header().Set("Last-Modified", out.LastModified.UTC().Format(http.TimeFormat))
		}
		if out.ContentLength != nil {
			w.Header().Set("Content-Length", fmt.Sprintf("%d", *out.ContentLength))
		}
		if out.ContentRange != nil && *out.ContentRange != "" {
			w.Header().Set("Content-Range", *out.ContentRange)
			w.WriteHeader(http.StatusPartialContent)
		}

		if r.Method == http.MethodHead {
			return
		}
		_, _ = io.Copy(w, out.Body)
		return
	}

	if svc.cfg.CFR2Enabled {
		svc.serveR2Object(w, r, fileID, filename)
		return
	}

	// Local filesystem storage
	fileDir := filepath.Join(svc.cfg.StorageDir, fileID)
	var targetFile string
	if filename != "" && filename != "." && filename != "/" {
		targetFile = filepath.Join(fileDir, filename)
	} else {
		entries, err := os.ReadDir(fileDir)
		if err != nil || len(entries) == 0 {
			http.NotFound(w, r)
			return
		}
		filename = entries[0].Name()
		targetFile = filepath.Join(fileDir, filename)
	}

	f, err := os.Open(targetFile)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil || stat.IsDir() {
		http.NotFound(w, r)
		return
	}

	// Sniff first 512 bytes for accurate Content-Type & XSS disposition check
	sniffBuf := make([]byte, 512)
	n, _ := f.Read(sniffBuf)
	_, _ = f.Seek(0, io.SeekStart)
	contentType := http.DetectContentType(sniffBuf[:n])

	setSecurityAndDispositionHeaders(w, stat.Name(), contentType)
	http.ServeContent(w, r, stat.Name(), stat.ModTime(), f)
}

func notifyChatAPI(baseURL, spaceID, uploaderID, authHeader string, asset FileAssetResponse) {
	endpoint := fmt.Sprintf("%s/api/v1/spaces/%s/files", baseURL, url.PathEscape(spaceID))
	payload := map[string]interface{}{
		"filename":     asset.Filename,
		"content_type": asset.ContentType,
		"size_bytes":   asset.SizeBytes,
		"url":          asset.URL,
		"user_id":      uploaderID,
		"metadata": map[string]interface{}{
			"sha256":  asset.SHA256,
			"backend": asset.Backend,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	req.Header.Set("X-User-Id", uploaderID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err == nil {
		_ = resp.Body.Close()
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	val := os.Getenv(key)
	if val == "true" || val == "1" {
		return true
	}
	if val == "false" || val == "0" {
		return false
	}
	return defaultVal
}

func parseTOMLValue(content, key string) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, key) {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				return strings.Trim(strings.TrimSpace(parts[1]), `"'`)
			}
		}
	}
	return ""
}

func (svc *StorageService) getR2OAuthToken(forceRefresh bool) (string, error) {
	svc.r2Mu.Lock()
	defer svc.r2Mu.Unlock()

	if !forceRefresh && svc.r2OAuthToken != "" {
		return svc.r2OAuthToken, nil
	}

	raw, err := os.ReadFile(svc.cfg.CFR2WranglerConfig)
	if err == nil {
		content := string(raw)
		tok := parseTOMLValue(content, "oauth_token")
		rt := parseTOMLValue(content, "refresh_token")
		if rt != "" {
			svc.r2RefreshToken = rt
		}
		if !forceRefresh && tok != "" {
			svc.r2OAuthToken = tok
			return tok, nil
		}
	}

	if svc.r2RefreshToken == "" {
		return "", fmt.Errorf("missing Cloudflare R2 OAuth refresh token")
	}

	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", svc.r2RefreshToken)
	form.Set("client_id", "54d11594-84e4-41aa-b438-e81b8fa78ee7")

	req, err := http.NewRequest(http.MethodPost, "https://dash.cloudflare.com/oauth2/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := svc.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("cloudflare oauth refresh returned status %d", resp.StatusCode)
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil || tokenResp.AccessToken == "" {
		return "", fmt.Errorf("failed to decode refreshed oauth token")
	}

	svc.r2OAuthToken = tokenResp.AccessToken
	if tokenResp.RefreshToken != "" {
		svc.r2RefreshToken = tokenResp.RefreshToken
	}

	// Persist refreshed token back to wrangler config
	if err == nil && len(raw) > 0 {
		updated := string(raw)
		oldTok := parseTOMLValue(updated, "oauth_token")
		oldRT := parseTOMLValue(updated, "refresh_token")
		if oldTok != "" {
			updated = strings.Replace(updated, fmt.Sprintf(`oauth_token = "%s"`, oldTok), fmt.Sprintf(`oauth_token = "%s"`, svc.r2OAuthToken), 1)
		}
		if oldRT != "" && svc.r2RefreshToken != "" {
			updated = strings.Replace(updated, fmt.Sprintf(`refresh_token = "%s"`, oldRT), fmt.Sprintf(`refresh_token = "%s"`, svc.r2RefreshToken), 1)
		}
		_ = os.WriteFile(svc.cfg.CFR2WranglerConfig, []byte(updated), 0600)
	}

	return svc.r2OAuthToken, nil
}

func (svc *StorageService) putR2Object(ctx context.Context, key string, file *os.File, size int64, contentType string) error {
	endpoint := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/%s/objects/%s",
		svc.cfg.CFR2AccountID, svc.cfg.CFR2Bucket, key)

	for attempt := 0; attempt < 2; attempt++ {
		tok, err := svc.getR2OAuthToken(attempt > 0)
		if err != nil {
			return err
		}
		if _, err := file.Seek(0, io.SeekStart); err != nil {
			return err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, io.NopCloser(file))
		if err != nil {
			return err
		}
		req.ContentLength = size
		req.Header.Set("Authorization", "Bearer "+tok)
		req.Header.Set("Content-Type", contentType)

		resp, err := svc.r2HTTPClient.Do(req)
		if err != nil {
			return err
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()

		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			continue
		}
		if resp.StatusCode >= 300 {
			return fmt.Errorf("r2 put status %d", resp.StatusCode)
		}
		return nil
	}
	return fmt.Errorf("r2 put unauthorized after token refresh")
}

func (svc *StorageService) resolveR2Filename(ctx context.Context, fileID string) (string, error) {
	prefix := url.QueryEscape(fmt.Sprintf("concord/%s/", fileID))
	endpoint := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/%s/objects?prefix=%s&per_page=1",
		svc.cfg.CFR2AccountID, svc.cfg.CFR2Bucket, prefix)

	for attempt := 0; attempt < 2; attempt++ {
		tok, err := svc.getR2OAuthToken(attempt > 0)
		if err != nil {
			return "", err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+tok)

		resp, err := svc.httpClient.Do(req)
		if err != nil {
			return "", err
		}
		if (resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden) && attempt == 0 {
			resp.Body.Close()
			continue
		}
		defer resp.Body.Close()

		var parsed struct {
			Result []struct {
				Key string `json:"key"`
			} `json:"result"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil || len(parsed.Result) == 0 {
			return "", fmt.Errorf("not found")
		}
		return filepath.Base(parsed.Result[0].Key), nil
	}
	return "", fmt.Errorf("unauthorized")
}

func (svc *StorageService) serveR2Object(w http.ResponseWriter, r *http.Request, fileID, filename string) {
	if filename == "" {
		resolved, err := svc.resolveR2Filename(r.Context(), fileID)
		if err != nil || resolved == "" {
			http.NotFound(w, r)
			return
		}
		filename = resolved
	}
	key := fmt.Sprintf("concord/%s/%s", fileID, filename)
	endpoint := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/%s/objects/%s",
		svc.cfg.CFR2AccountID, svc.cfg.CFR2Bucket, key)

	for attempt := 0; attempt < 2; attempt++ {
		tok, err := svc.getR2OAuthToken(attempt > 0)
		if err != nil {
			http.Error(w, "Storage auth error", http.StatusInternalServerError)
			return
		}

		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, endpoint, nil)
		if err != nil {
			http.Error(w, "Request error", http.StatusInternalServerError)
			return
		}
		req.Header.Set("Authorization", "Bearer "+tok)
		if rng := r.Header.Get("Range"); rng != "" {
			req.Header.Set("Range", rng)
		}

		resp, err := svc.r2HTTPClient.Do(req)
		if err != nil {
			http.Error(w, "Upstream R2 error", http.StatusBadGateway)
			return
		}

		if (resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden) && attempt == 0 {
			resp.Body.Close()
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusNotFound {
			http.NotFound(w, r)
			return
		}
		if resp.StatusCode >= 300 {
			http.Error(w, "R2 fetch error", http.StatusBadGateway)
			return
		}

		contentType := resp.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		setSecurityAndDispositionHeaders(w, filename, contentType)
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Accept-Ranges", "bytes")

		if etag := resp.Header.Get("ETag"); etag != "" {
			w.Header().Set("ETag", etag)
		}
		if cl := resp.Header.Get("Content-Length"); cl != "" {
			w.Header().Set("Content-Length", cl)
		}
		if cr := resp.Header.Get("Content-Range"); cr != "" {
			w.Header().Set("Content-Range", cr)
			w.WriteHeader(http.StatusPartialContent)
		}

		if r.Method == http.MethodHead {
			return
		}
		_, _ = io.Copy(w, resp.Body)
		return
	}
}

