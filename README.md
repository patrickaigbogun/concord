# Concord

Concord is a real-time communication platform built on a stateless API architecture designed to support web, mobile, and desktop clients.

---

## 🏛 Architecture Overview

Concord follows a client-agnostic, contract-first design. The core backend serves REST endpoints and WebSocket channels, while clients consume typed SDKs generated directly from OpenAPI specifications.

```
concord/
├── clients/
│   ├── www/           # Dex SPA (React 19, Tailwind CSS v4, @dex/pie)
│   ├── mobile/        # Mobile client
│   └── desktop/       # Desktop client
├── server/
│   └── api/           # Phoenix (Elixir) REST & Realtime Channels API
└── docs/              # Technical & API architecture specifications
```

---

## 🛠 Tech Stack

- **Backend (`server/api`)**:
  - [Elixir](https://elixir-lang.org/) & [Phoenix Framework](https://phoenixframework.org/)
  - [PostgreSQL](https://www.postgresql.org/) with Ecto (UUIDv7 primary keys)
  - [OpenApiSpex](https://github.com/open-api-spex/open_api_spex) for contract-first schema & OpenAPI specs
  - Phoenix Channels / WebSockets for real-time messaging and events

- **Web Client (`clients/www`)**:
  - [Dex](https://github.com/dex) Single-Page Application framework
  - [React 19](https://react.dev/) & [Tailwind CSS v4](https://tailwindcss.com/)
  - [`@dex/pie`](https://github.com/dex) type-safe API client generator & RPC layer
  - [Bun](https://bun.sh/) runtime & package manager

---

## Getting Started

### Prerequisites

- **Elixir & Erlang/OTP** (managed via `mise` or system install)
- **Bun** (>= 1.1)
- **Docker** (for PostgreSQL)

---

### Backend Setup (`server/api`)

1. Start PostgreSQL (e.g. via Docker):
   ```bash
   docker run --name concord-postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres:16
   ```

2. Install dependencies & run migrations:
   ```bash
   cd server/api
   mix deps.get
   mix ecto.setup
   ```

3. Start the Phoenix API server:
   ```bash
   mix phx.server
   ```
   The API will be available at `http://localhost:4000` with Swagger UI at `http://localhost:4000/api/swagger` and OpenAPI spec at `http://localhost:4000/api/openapi.json`.

---

### Web Client Setup (`clients/www`)

1. Install dependencies:
   ```bash
   cd clients/www
   bun install
   ```

2. Generate/synchronize API types from backend:
   ```bash
   bun run generate:api
   ```

3. Start the development server:
   ```bash
   bun dev
   ```

---

## 📄 License

none.
