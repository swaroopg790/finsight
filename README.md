# FinSight

> AI-powered portfolio operating system for retail investors.

FinSight aggregates brokerage accounts, analyzes portfolio risk, and delivers personalized AI-driven insights — acting as a financial copilot for retail investors.

---

## Current Status — Sprint 1 (Brokerage Aggregation)

**Backend:** ✅ Compiles clean — blocked on Docker for local Postgres/Redis
**Frontend:** ✅ Type-checks clean — can run with `npm run dev`
**AI Service:** ✅ Files ready — blocked on Python 3.11+ installation
**Infrastructure:** ✅ Docker Compose ready — blocked on Docker Desktop installation

---

## Prerequisites

| Tool | Version | Status | Install |
|---|---|---|---|
| Java JDK | 21 | ✅ Installed | — |
| Maven | 3.9.6 | ✅ Installed | — |
| Node.js | 22.x | ✅ Installed | — |
| Docker Desktop | Latest | ❌ Not installed | [docker.com](https://docker.com/products/docker-desktop) |
| Python | 3.11+ | ❌ Not installed | [python.org](https://python.org) |

---

## Running Locally (once Docker is installed)

### 1. Start database + cache
```powershell
docker compose -f infrastructure/docker-compose.yml up -d
```

### 2. Set environment variables
Create a `.env` or set in your shell:
```
FINSIGHT_JWT_SECRET=your-secret-32-chars-minimum-here!
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
```

### 3. Start the backend
```powershell
cd backend/portfolio-service
.\mvnw.cmd spring-boot:run
# Listening on http://localhost:8080
# Flyway runs migrations automatically on first start
```

### 4. Start the frontend
```powershell
cd frontend/finsight-web
npm run dev
# Listening on http://localhost:5173
```

### 5. Start the AI service (once Python is installed)
```powershell
cd ai-service
pip install -r requirements.txt
# Create .env with ANTHROPIC_API_KEY=your-key
uvicorn main:app --reload --port 8001
# Listening on http://localhost:8001
```

---

## API Endpoints (Sprint 1)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | None | Register new user, returns JWT |
| POST | `/api/v1/auth/login` | None | Login, returns JWT |
| POST | `/api/v1/plaid/link-token` | JWT | Create Plaid Link token (stub) |
| POST | `/api/v1/plaid/exchange-token` | JWT | Exchange public token (stub) |
| GET | `/api/v1/portfolio/holdings` | JWT | Get all holdings for user |
| GET | `/api/v1/portfolio/accounts` | JWT | Get all accounts for user |
| GET | `/actuator/health` | None | Health check |
| POST | `/analyze/portfolio` | None | AI portfolio analysis (port 8001) |

---

## Project Structure

```
finsight/
├── CLAUDE.md                          ← project context (auto-loaded by Claude Code)
├── backend/portfolio-service/         ← Java 21 + Spring Boot 4.0.6
│   ├── pom.xml
│   └── src/main/java/com/finsight/portfolio/
│       ├── api/controller/            ← AuthController, PlaidController, PortfolioController
│       ├── api/dto/                   ← request/response records
│       ├── api/exception/             ← GlobalExceptionHandler
│       ├── config/                    ← SecurityConfig (JWT + CORS)
│       ├── domain/model/              ← User, PlaidItem, Account, Position
│       ├── domain/repository/         ← Spring Data JPA interfaces
│       ├── domain/service/            ← AuthService, PortfolioService
│       └── infrastructure/            ← PlaidClient (stub), PortfolioSyncScheduler (stub)
├── frontend/finsight-web/             ← React 18 + TypeScript + Vite 8
│   └── src/
│       ├── lib/api.ts                 ← Axios client with JWT interceptor
│       ├── pages/LoginPage.tsx
│       └── pages/DashboardPage.tsx
├── ai-service/                        ← Python 3.11 + FastAPI + Anthropic SDK
│   ├── main.py
│   └── routes/analyze.py              ← Claude claude-sonnet-4-6 portfolio analysis
├── infrastructure/
│   └── docker-compose.yml             ← Postgres 16 + Redis 7
└── docs/
    ├── architecture.md                ← ADRs including Spring Boot decision rationale
    └── mvp-scope.md                   ← detailed sprint tracker with current status
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21 + Spring Boot 4.0.6 |
| Frontend | React 18 + TypeScript + Vite 8 |
| AI Service | Python 3.11 + FastAPI + Anthropic Claude API |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Broker Data | Plaid API (sandbox) |
| Market Data | Polygon.io (Sprint 2) |
| Cloud | Azure (post-MVP) |
