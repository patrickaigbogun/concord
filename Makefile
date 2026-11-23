.PHONY: build-all build-id build-storage build-gateway run-id run-storage run-gateway run-chat run-web help

help:
	@echo "Concord Services Manager"
	@echo "  make build-all    Build all Go microservices (ID, Storage, Gateway)"
	@echo "  make run-gateway  Run Concord API Gateway on :8080"
	@echo "  make run-id       Run Concord ID (OAuth2/OIDC Auth Server on :4001)"
	@echo "  make run-storage  Run Concord Storage (File Ingestion on :4002)"
	@echo "  make run-chat     Run Phoenix Chat & Realtime API on :4000"
	@echo "  make run-web      Run Dex / React 19 Web App on :3000"

build-id:
	@cd services/id && mkdir -p bin && go build -o bin/concord-id cmd/server/main.go
	@echo "✓ services/id/bin/concord-id built successfully"

build-storage:
	@cd services/storage && mkdir -p bin && go build -o bin/concord-storage cmd/server/main.go
	@echo "✓ services/storage/bin/concord-storage built successfully"

build-gateway:
	@cd services/gateway && mkdir -p bin && go build -o bin/concord-gateway cmd/server/main.go
	@echo "✓ services/gateway/bin/concord-gateway built successfully"

build-all: build-id build-storage build-gateway

run-gateway: build-gateway
	@cd services/gateway && ./bin/concord-gateway -port 8080

run-id: build-id
	@cd services/id && ./bin/concord-id -port 4001

run-storage: build-storage
	@cd services/storage && ./bin/concord-storage -port 4002

run-chat:
	@cd services/chat/api && mix phx.server

run-web:
	@cd clients/www && bun dev
