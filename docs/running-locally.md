# Instructions to Bring Up Services

How to start FinSight's full local stack (Postgres, Redis, backend, AI service, frontend) and how to fix the common failure at each step.

---

## Quick start

1. Start **Docker Desktop** (desktop icon) and wait for the engine to finish starting — the whale icon in the system tray stops animating once it's ready. You can also confirm inside the Docker Desktop window: the Containers tab should load a container list instead of a "starting..." screen.
2. Open PowerShell at the project root and run:
   ```powershell
   cd C:\Projects\finsight
   .\start.ps1
   ```
3. The script brings services up **in order** and waits for each to respond before starting the next: Postgres + Redis → backend (8080) → AI service (8000) → frontend (5173). It opens a separate PowerShell window per service and finishes by opening `http://localhost:5173` in your browser.

If `start.ps1` fails partway through, fix that step (see below) and re-run the whole script — earlier services that are already healthy will be left alone (Docker Compose) or simply keep running in their own window (backend/AI/frontend), so re-running is safe.

> **Note:** `start.ps1` writes plain-ASCII status output on purpose. Windows PowerShell 5.1 reads `.ps1` files without a UTF-8 BOM using the system codepage, and the original version of this script used box-drawing/checkmark characters (✓ ✗ ▶ → —) that got corrupted on read and broke the parser. Don't reintroduce non-ASCII characters into this file.

---

## Service-by-service

### 1. Docker (Postgres + Redis)

- Runs `docker compose -f infrastructure\docker-compose.yml up -d`, then polls `docker inspect` until both `finsight-postgres` and `finsight-redis` report `healthy` (up to ~40s).
- **"Docker Desktop is not running"** — open Docker Desktop manually and wait for the engine before re-running the script. First cold start after a reboot can take 30–90 seconds.
- **Containers never go healthy** — open Docker Desktop's Containers tab and check the container logs directly; a common cause is a stale volume from a previous run. `docker compose -f infrastructure\docker-compose.yml down` then re-run `start.ps1` to recreate them.

### 2. Backend — Spring Boot, port 8080

- Opens a new window, loads Plaid/JWT/encryption env vars from your **User-scope environment variables** (not `.env.local` — that file is only read by `start-backend.ps1`, a separate manual-start script), and runs `.\mvnw.cmd spring-boot:run` in `backend\portfolio-service`.
- First run compiles from scratch and can take 1–2 minutes; `start.ps1` polls `/actuator/health` for up to 120 seconds before giving up.
- **Visiting `http://localhost:8080` shows a 401** — this is expected and means the backend *is* running. Spring Security rejects unauthenticated requests to routes it doesn't explicitly permit, and bare `/` isn't a mapped route. Check `http://localhost:8080/actuator/health` instead — that one is open with no auth and should return `{"status":"UP"}`.
- **"Backend didn't start" after 120s** — check the backend's own window for the real error (most often a missing env var, or Postgres not actually healthy yet). Required env vars: `FINSIGHT_JWT_SECRET` (32+ chars), `PLAID_CLIENT_ID`, `PLAID_SECRET`.

### 3. AI service — FastAPI/Uvicorn, port 8000

- Runs `.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000 --reload` from `ai-service\`.
- **`.venv` doesn't exist / python.exe not found** — create it first:
  ```powershell
  cd C:\Projects\finsight\ai-service
  python -m venv .venv
  .\.venv\Scripts\pip.exe install -r requirements.txt
  ```
- Needs `ANTHROPIC_API_KEY` set (in `ai-service\.env` or as a User env var) for the actual Claude-powered analysis endpoint to work, though the service will still start and pass its health check without it.

### 4. Frontend — Vite/React, port 5173

- Runs `npm run dev` from `frontend\finsight-web`. Unlike the other two services, **`start.ps1` does not run `npm install` for you** — it assumes dependencies are already present.
- **`ERR_CONNECTION_REFUSED` on localhost:5173** — nothing is listening on that port at all, which usually means the frontend's own window hit an error and exited. Open the window titled **"FinSight Frontend"** and check what's printed. Common causes and fixes:
  | Symptom in that window | Fix |
  |---|---|
  | `'vite' is not recognized...` or `Cannot find module` | Dependencies were never installed — run `npm install` in `frontend\finsight-web`, then re-run `start.ps1` |
  | `Error: listen EADDRINUSE :::5173` | Something else is already using port 5173 — find and close it, or change the port in `frontend\finsight-web\vite.config.ts` |
  | Window flashes and closes immediately | Run `cd frontend\finsight-web; npm run dev` manually (without `start.ps1`) so the window stays open and you can read the error |
  | No error, just hangs | Give it longer — Vite's first cold start (pre-bundling dependencies) can take longer than the script's fixed 4-second wait before it declares success. Check the URL again after another 10–15s even if `start.ps1` already moved on. |

---

## URLs once everything is up

| Service | URL |
|---|---|
| App (frontend) | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| Backend health check | http://localhost:8080/actuator/health |
| AI service | http://localhost:8000 |
| AI service health check | http://localhost:8000/health |

---

## Starting services individually (without start.ps1)

Useful when one service keeps failing inside `start.ps1` and you want to see its output directly instead of in a spawned window.

```powershell
# Postgres + Redis
docker compose -f C:\Projects\finsight\infrastructure\docker-compose.yml up -d

# Backend (reads .env.local automatically)
cd C:\Projects\finsight
.\start-backend.ps1

# AI service
cd C:\Projects\finsight\ai-service
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd C:\Projects\finsight\frontend\finsight-web
npm install   # first time only, or after pulling new dependencies
npm run dev
```

## Stopping everything

```powershell
cd C:\Projects\finsight
.\stop.ps1
```
