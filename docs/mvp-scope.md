# MVP Scope — Sprint 1: Brokerage Aggregation

## Goal
Enable a user to connect a brokerage account via Plaid, sync their holdings, and see a basic portfolio view. This is the data foundation everything else is built on.

---

## Sprint 1 Status

### Backend — `backend/portfolio-service/` (Spring Boot 4.0.6 + Java 21)
- [x] Project scaffolded via Spring Initializr (Spring Boot 4.0.6)
- [x] `application.yml` configured (Postgres, Redis, JWT, CORS, Plaid env vars)
- [x] JWT auth: `POST /api/v1/auth/register` + `POST /api/v1/auth/login`
- [x] JPA entities: `User`, `PlaidItem`, `Account`, `Position`
- [x] Spring Data repositories for all 4 entities
- [x] Flyway migrations: V1 (users) → V2 (plaid_items) → V3 (accounts) → V4 (positions)
- [x] `GET /api/v1/portfolio/holdings` — returns normalized holdings for JWT user
- [x] `GET /api/v1/portfolio/accounts` — returns connected accounts for JWT user
- [x] `POST /api/v1/plaid/link-token` — **STUB** (returns fake token, no real Plaid call)
- [x] `POST /api/v1/plaid/exchange-token` — **STUB** (logs, no real Plaid call)
- [x] `PortfolioSyncScheduler` — wired to fire every 4h, sync logic is **STUB**
- [x] `GlobalExceptionHandler` — RFC 7807 ProblemDetail responses
- [x] `SecurityConfig` — JWT OAuth2 Resource Server, CORS configured for `localhost:5173`
- [x] Compiles clean: `.\mvnw.cmd compile` passes with no errors
- [ ] **BLOCKED: cannot run** — Docker Desktop not installed (needs Postgres + Redis)

### Frontend — `frontend/finsight-web/` (React 18 + TypeScript + Vite 8)
- [x] Project scaffolded (Vite 8, TypeScript 6, React 18)
- [x] React + `@types/react` installed (corrected from vanilla template)
- [x] `tsconfig.json` — JSX configured (`react-jsx`)
- [x] Axios API client (`src/lib/api.ts`) — base URL, auth interceptor, 401 redirect
- [x] React Router v7 routing: `/login` → `LoginPage`, `/` → `DashboardPage` (protected)
- [x] TanStack Query v5 configured with 60s stale time
- [x] `LoginPage.tsx` — email/password form, JWT stored to localStorage
- [x] `DashboardPage.tsx` — accounts list + holdings table, total portfolio value
- [x] Type-checks clean: `npx tsc --noEmit` passes with no errors
- [x] Can start with `npm run dev` (runs on `localhost:5173`)
- [ ] Plaid Link OAuth flow — NOT YET BUILT (Sprint 2)

### AI Service — `ai-service/` (Python FastAPI + Anthropic SDK)
- [x] `main.py` — FastAPI app with lifespan, CORS middleware, health endpoint
- [x] `routes/analyze.py` — `POST /analyze/portfolio` → calls Claude `claude-sonnet-4-6`
- [x] `requirements.txt` — fastapi, uvicorn, anthropic, pydantic, httpx
- [x] `.env.example` — documents required `ANTHROPIC_API_KEY`
- [ ] **BLOCKED: cannot run** — Python 3.11+ not installed on this machine

### Infrastructure — `infrastructure/`
- [x] `docker-compose.yml` — Postgres 16 + Redis 7 with health checks and named volumes
- [ ] **BLOCKED: cannot run** — Docker Desktop not installed on this machine

---

## Blockers to Resolve Before Sprint 2

| Blocker | Action Required | Impact |
|---|---|---|
| Docker Desktop not installed | Install from docker.com/products/docker-desktop | Backend won't start without Postgres |
| Python 3.11+ not installed | Install from python.org | AI service can't run |
| Plaid API keys not set | Create sandbox account at plaid.com/docs | Plaid endpoints will fail at runtime |
| Anthropic API key not set | Get from console.anthropic.com | AI analysis endpoint returns 503 |

---

## Sprint 2 — Next Up (after blockers resolved)

### Plaid Integration (real API calls)
- [ ] Add `plaid-java` SDK to `pom.xml` (com.plaid:plaid-java)
- [ ] Implement `PlaidClient.createLinkToken()` — real Plaid `/link/token/create` call
- [ ] Implement `PlaidClient.exchangePublicToken()` — real Plaid `/item/public_token/exchange`
- [ ] Implement AES-256 encryption for `access_token_encrypted` in `PlaidItem`
- [ ] Implement `PortfolioSyncScheduler.syncAllPortfolios()` — call Plaid `/investments/holdings/get`
- [ ] Frontend: integrate Plaid Link React component (`react-plaid-link`)

### Market Data
- [ ] Add Polygon.io client to enrich positions with current price + name
- [ ] Update sync job to call Polygon after Plaid sync

### AI Integration
- [ ] Backend: call AI service after sync to generate portfolio insights
- [ ] Frontend: display AI insights on Dashboard

---

## Success Criteria for Sprint 1 Completion
1. `docker compose up -d` starts Postgres + Redis with no errors
2. Spring Boot starts, Flyway runs all 4 migrations, app listens on `:8080`
3. `POST /api/v1/auth/register` creates a user, returns JWT
4. `GET /api/v1/portfolio/holdings` returns `[]` (empty) for new user
5. Frontend `npm run dev` starts, login page renders, login works with the registered user
6. AI service `uvicorn main:app` starts, `/health` returns `{"status":"ok"}`
