# Architecture Decisions — FinSight

## Decision Log

### ADR-000: Backend Language — Spring Boot (Java 21) ✅ Evaluated
**Decision:** Spring Boot (Java 21) for the `portfolio-service` backend.
**Evaluated alternatives:** Node.js + TypeScript (Fastify), Python FastAPI (consolidate with ai-service), Go (Fiber).
**Why Spring Boot won:**
- FinSight's roadmap includes a tax-loss harvesting engine, portfolio risk calculator, and options analytics — complex domain logic where Java's type system and financial libraries (QuantLib, Apache Commons Math) are a genuine advantage, not just familiarity.
- Java 21 virtual threads eliminate the I/O-bound performance argument for Node.js.
- Keeping two runtimes (Java + Python) with a clean contract is acceptable; adding Node as a third is not worth it.
- Python consolidation was tempting but Python's type system is weaker for complex financial domain modeling at scale.
**Constraint:** Keep `portfolio-service` lean and thin at MVP. Clean package boundaries now so services can be extracted later without pain.

### ADR-001: Monorepo Structure
**Decision:** Single monorepo with `backend/`, `frontend/`, `ai-service/`, `infrastructure/` directories.
**Rationale:** Easier context switching and coordinated changes during early development. Extract to separate repos when team scales or CI/CD requires it.

### ADR-002: Local-First for MVP, Azure Post-MVP
**Decision:** MVP runs fully on Docker Compose (Postgres + Redis + services on localhost). No cloud until post-MVP.
**Rationale:** Eliminates cloud cost and complexity during validation. Azure is the target cloud when we scale.
**Azure targets (post-MVP):** AKS (services), Azure Database for PostgreSQL, Azure Cache for Redis, Azure Service Bus (async messaging).

### ADR-003: Backend as API Gateway
**Decision:** Frontend never calls Plaid or any external API directly. All external calls go through the backend.
**Rationale:** Security (Plaid access tokens never reach the browser), centralized rate limiting, single audit trail.

### ADR-004: AI Service as Separate Process
**Decision:** Python/FastAPI microservice handles all Anthropic Claude API calls, separate from Spring Boot backend.
**Rationale:** Python has better AI/ML ecosystem. Keeps Java backend lean. Allows independent scaling of AI inference.
**Communication:** Backend calls AI service via HTTP (MVP). Azure Service Bus for async (post-MVP).

### ADR-005: Plaid Access Token Encryption
**Decision:** Plaid access tokens are encrypted at rest using AES-256. Never logged, never returned to frontend.
**Rationale:** Plaid tokens grant full read access to brokerage data. Must be treated as secrets.

### ADR-006: REST API with OpenAPI-First Design
**Decision:** Design API contracts in OpenAPI spec before implementation. Use Springdoc for auto-generation.
**Rationale:** Contract-first forces clarity. Frontend and AI service can be developed in parallel.
**Base path:** `/api/v1/`

### ADR-007: Anthropic Claude Model Selection
**Decision:** Use `claude-sonnet-4-6` for deep portfolio analysis; `claude-haiku-4-5` for fast, lightweight operations.
**Rationale:** Cost/performance tradeoff. Sonnet for insight generation (low frequency), Haiku for quick queries (high frequency).

---

## System Diagram (MVP)

```
[User Browser]
      │
      ▼
[React Frontend :5173]
      │  REST /api/v1/
      ▼
[Spring Boot Backend :8080]
      │                    │
      ▼                    ▼
[PostgreSQL :5432]    [Redis :6379]
      │
      ▼
[Python AI Service :8001]
      │
      ▼
[Anthropic Claude API]
      │
[Plaid API] (called from backend)
[Polygon.io] (called from backend)
```

---

## Post-MVP Azure Architecture (Target)

```
[Azure Front Door / CDN]
      │
[AKS — React static assets via Azure Static Web Apps]
      │
[AKS — Spring Boot pods (HPA-scaled)]
      │                         │
[Azure DB for PostgreSQL]   [Azure Cache for Redis]
      │
[AKS — Python AI Service pods]
      │
[Azure Service Bus] ← async job queue
      │
[Anthropic Claude API]
```
