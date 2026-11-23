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
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type Config struct {
	Port         string
	StorageDir   string
	PublicURL    string
	ChatAPIURL   string
	MaxUploadMB  int64

	// S3 Configuration (Works for AWS S3, MinIO, R2, Wasabi, B2)
	S3Enabled    bool
	S3Bucket     string
	S3Region     string
	S3Endpoint   string
	S3AccessKey  string
	S3SecretKey  string
	S3PathStyle  bool
}

type StorageService struct {
	cfg      Config
	s3Client *s3.Client
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
	maxMB := flag.Int64("max-mb", 500, "Maximum upload size in Megabytes")

	// S3 flags / env vars
	s3Bucket := flag.String("s3-bucket", getEnv("S3_BUCKET", ""), "S3 bucket name (if set, uses S3-compatible backend)")
	s3Region := flag.String("s3-region", getEnv("S3_REGION", "us-east-1"), "S3 region")
	s3Endpoint := flag.String("s3-endpoint", getEnv("S3_ENDPOINT", ""), "Custom S3 endpoint (e.g. http://localhost:9000 for MinIO)")
	s3AccessKey := flag.String("s3-access-key", getEnv("S3_ACCESS_KEY_ID", ""), "S3 access key ID")
	s3SecretKey := flag.String("s3-secret-key", getEnv("S3_SECRET_ACCESS_KEY", ""), "S3 secret access key")
	s3PathStyle := flag.Bool("s3-force-path-style", getEnvBool("S3_FORCE_PATH_STYLE", true), "Force path style (standard for MinIO)")
	flag.Parse()

	cfg := Config{
		Port:        *port,
		StorageDir:  *storageDir,
		PublicURL:   strings.TrimRight(*publicURL, "/"),
		ChatAPIURL:  strings.TrimRight(*chatAPIURL, "/"),
		MaxUploadMB: *maxMB,
		S3Enabled:   *s3Bucket != "",
		S3Bucket:    *s3Bucket,
		S3Region:    *s3Region,
		S3Endpoint:  *s3Endpoint,
		S3AccessKey: *s3AccessKey,
		S3SecretKey: *s3SecretKey,
		S3PathStyle: *s3PathStyle,
	}

	var s3Client *s3.Client
	if cfg.S3Enabled {
		client, err := initS3(cfg)
		if err != nil {
			log.Fatalf("Fatal: Failed to initialize S3 client: %v", err)
		}
		s3Client = client
		log.Printf("✓ S3-Compatible storage initialized (Bucket: %s, Endpoint: %s)", cfg.S3Bucket, cfg.S3Endpoint)
	} else {
		if err := os.MkdirAll(cfg.StorageDir, 0755); err != nil {
			log.Fatalf("Fatal: Cannot create storage directory: %v", err)
		}
		log.Printf("✓ Local disk storage initialized at: %s", cfg.StorageDir)
	}

	svc := &StorageService{
		cfg:      cfg,
		s3Client: s3Client,
	}

	mux := http.NewServeMux()

	withCORS := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id, X-Space-Id")
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
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "concord-storage",
			"backend": backend,
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
	log.Printf("   • Public URL: %s", cfg.PublicURL)

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

func (svc *StorageService) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, svc.cfg.MaxUploadMB*1024*1024)

	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, fmt.Sprintf("Upload failed or exceeded size: %v", err), http.StatusBadRequest)
		return
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
	uploaderID := r.FormValue("user_id")
	if uploaderID == "" {
		uploaderID = r.Header.Get("X-User-Id")
	}

	fileID := uuid.New().String()
	sanitizedFilename := filepath.Base(header.Filename)
	if sanitizedFilename == "." || sanitizedFilename == "/" {
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
	if header.Header.Get("Content-Type") != "" && header.Header.Get("Content-Type") != "application/octet-stream" {
		detectedContentType = header.Header.Get("Content-Type")
	}

	var totalBytes int64
	backendUsed := "local"

	if svc.cfg.S3Enabled {
		backendUsed = "s3"
		// Buffer data for S3 upload
		var s3Buf bytes.Buffer
		mw := io.MultiWriter(&s3Buf, hasher)
		if n > 0 {
			_, _ = mw.Write(sniffBuf[:n])
		}
		written, err := io.Copy(mw, file)
		if err != nil {
			http.Error(w, "Failed to read upload stream", http.StatusInternalServerError)
			return
		}
		totalBytes = int64(n) + written

		s3Key := fmt.Sprintf("concord/%s/%s", fileID, sanitizedFilename)
		_, err = svc.s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
			Bucket:      aws.String(svc.cfg.S3Bucket),
			Key:         aws.String(s3Key),
			Body:        bytes.NewReader(s3Buf.Bytes()),
			ContentType: aws.String(detectedContentType),
		})
		if err != nil {
			log.Printf("❌ S3 upload error: %v", err)
			http.Error(w, "Failed to store in S3", http.StatusInternalServerError)
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
			_, _ = mw.Write(sniffBuf[:n])
		}
		written, err := io.Copy(mw, file)
		if err != nil {
			http.Error(w, "Stream copy error", http.StatusInternalServerError)
			return
		}
		totalBytes = int64(n) + written
	}

	shaHex := hex.EncodeToString(hasher.Sum(nil))
	publicFileURL := fmt.Sprintf("%s/files/%s/%s", svc.cfg.PublicURL, fileID, urlPathEscape(sanitizedFilename))

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
		go notifyChatAPI(svc.cfg.ChatAPIURL, spaceID, uploaderID, resp)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(resp)
}

func (svc *StorageService) handleServeFiles(w http.ResponseWriter, r *http.Request) {
	pathPart := strings.TrimPrefix(r.URL.Path, "/files/")
	parts := strings.SplitN(pathPart, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	fileID := parts[0]
	filename := ""
	if len(parts) == 2 {
		filename = parts[1]
	}

	// Cache for 1 year (immutable asset)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")

	if svc.cfg.S3Enabled {
		s3Key := fmt.Sprintf("concord/%s/%s", fileID, filename)
		out, err := svc.s3Client.GetObject(context.TODO(), &s3.GetObjectInput{
			Bucket: aws.String(svc.cfg.S3Bucket),
			Key:    aws.String(s3Key),
		})
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer out.Body.Close()

		if out.ContentType != nil {
			w.Header().Set("Content-Type", *out.ContentType)
		}
		if out.ContentLength != nil {
			w.Header().Set("Content-Length", fmt.Sprintf("%d", *out.ContentLength))
		}
		_, _ = io.Copy(w, out.Body)
		return
	}

	// Local filesystem fallback
	fileDir := filepath.Join(svc.cfg.StorageDir, fileID)
	var targetFile string
	if filename != "" {
		targetFile = filepath.Join(fileDir, filepath.Base(filename))
	} else {
		entries, err := os.ReadDir(fileDir)
		if err != nil || len(entries) == 0 {
			http.NotFound(w, r)
			return
		}
		targetFile = filepath.Join(fileDir, entries[0].Name())
	}

	f, err := os.Open(targetFile)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}

	http.ServeContent(w, r, stat.Name(), stat.ModTime(), f)
}

func notifyChatAPI(baseURL, spaceID, uploaderID string, asset FileAssetResponse) {
	url := fmt.Sprintf("%s/api/v1/spaces/%s/files", baseURL, spaceID)
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

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-Id", uploaderID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err == nil {
		_ = resp.Body.Close()
	}
}

func urlPathEscape(s string) string {
	return strings.ReplaceAll(s, " ", "%20")
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
