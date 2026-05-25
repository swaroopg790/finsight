# FinSight — start all services
# Usage: right-click → "Run with PowerShell"  OR  tell Claude "start the app"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

$ROOT = $PSScriptRoot

function Write-Step($msg) { Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }

# ── 1. Docker ────────────────────────────────────────────────────────────────
Write-Step "Starting Docker containers (Postgres + Redis)..."

$dockerRunning = docker info 2>&1 | Select-String "Server Version" -Quiet
if (-not $dockerRunning) {
  Write-Err "Docker Desktop is not running. Please start it from the taskbar, then re-run this script."
  pause; exit 1
}

docker compose -f "$ROOT\infrastructure\docker-compose.yml" up -d 2>&1 | Out-Null

$retries = 0
while ($retries -lt 20) {
  $pg = docker inspect finsight-postgres --format "{{.State.Health.Status}}" 2>&1
  $rd = docker inspect finsight-redis    --format "{{.State.Health.Status}}" 2>&1
  if ($pg -eq "healthy" -and $rd -eq "healthy") { break }
  Start-Sleep -Seconds 2
  $retries++
}
if ($retries -ge 20) { Write-Err "Containers didn't become healthy in time."; pause; exit 1 }
Write-Ok "Postgres + Redis healthy"

# ── 2. Backend ───────────────────────────────────────────────────────────────
Write-Step "Starting Spring Boot backend (port 8080)..."

# Load User-scope env vars from registry so the backend process gets them.
# These are set once via SetEnvironmentVariable and persist across reboots.
$plaidClientId  = [System.Environment]::GetEnvironmentVariable("PLAID_CLIENT_ID",         "User")
$plaidSecret    = [System.Environment]::GetEnvironmentVariable("PLAID_SECRET",             "User")
$plaidMode      = [System.Environment]::GetEnvironmentVariable("PLAID_MODE",               "User")
$encKey         = [System.Environment]::GetEnvironmentVariable("FINSIGHT_ENCRYPTION_KEY",  "User")
$jwtSecret      = [System.Environment]::GetEnvironmentVariable("FINSIGHT_JWT_SECRET",      "User")
$polygonKey     = [System.Environment]::GetEnvironmentVariable("POLYGON_API_KEY",          "User")
$groqKey        = [System.Environment]::GetEnvironmentVariable("GROQ_API_KEY",             "User")

$envSetup = ""
if ($plaidClientId) { $envSetup += "`$env:PLAID_CLIENT_ID = '$plaidClientId'; " }
if ($plaidSecret)   { $envSetup += "`$env:PLAID_SECRET    = '$plaidSecret'; "   }
if ($plaidMode)     { $envSetup += "`$env:PLAID_MODE      = '$plaidMode'; "     }
if ($encKey)        { $envSetup += "`$env:FINSIGHT_ENCRYPTION_KEY = '$encKey'; " }
if ($jwtSecret)     { $envSetup += "`$env:FINSIGHT_JWT_SECRET     = '$jwtSecret'; " }
if ($polygonKey)    { $envSetup += "`$env:POLYGON_API_KEY         = '$polygonKey'; " }
if ($groqKey)       { $envSetup += "`$env:GROQ_API_KEY            = '$groqKey'; " }

$backendCmd = "Write-Host 'FinSight Backend' -ForegroundColor Cyan; " +
              $envSetup +
              "cd '$ROOT\backend\portfolio-service'; " +
              ".\mvnw.cmd spring-boot:run"

Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $backendCmd

$retries = 0
while ($retries -lt 40) {
  Start-Sleep -Seconds 3
  $h = try { Invoke-WebRequest "http://localhost:8080/actuator/health" -UseBasicParsing -TimeoutSec 2 } catch { $null }
  if ($h) { break }
  $retries++
}
if ($retries -ge 40) { Write-Err "Backend didn't start — check the backend window."; pause; exit 1 }
Write-Ok "Backend running at http://localhost:8080"

# ── 3. AI Service ─────────────────────────────────────────────────────────────
Write-Step "Starting Python AI service (port 8000)..."

$groqKey = [System.Environment]::GetEnvironmentVariable("GROQ_API_KEY", "User")

$aiEnvSetup = ""
if ($groqKey) { $aiEnvSetup += "`$env:GROQ_API_KEY = '$groqKey'; " }

$aiCmd = "Write-Host 'FinSight AI Service' -ForegroundColor Yellow; " +
         $aiEnvSetup +
         "cd '$ROOT\ai-service'; " +
         ".\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $aiCmd

$retries = 0
while ($retries -lt 20) {
  Start-Sleep -Seconds 2
  $h = try { Invoke-WebRequest "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 } catch { $null }
  if ($h) { break }
  $retries++
}
if ($retries -ge 20) { Write-Err "AI service didn't start — check the AI service window."; pause; exit 1 }
Write-Ok "AI service running at http://localhost:8000"

# ── 4. Frontend ──────────────────────────────────────────────────────────────
Write-Step "Starting React frontend (port 5173)..."

$frontendCmd = "Write-Host 'FinSight Frontend' -ForegroundColor Magenta; " +
               "cd '$ROOT\frontend\finsight-web'; " +
               "npm run dev"

Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $frontendCmd

Start-Sleep -Seconds 4
Write-Ok "Frontend running at http://localhost:5173"

# ── 5. Open browser ──────────────────────────────────────────────────────────
Write-Step "Opening app in browser..."
Start-Process "http://localhost:5173"

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  FinSight is running!" -ForegroundColor White
Write-Host "  App      → http://localhost:5173" -ForegroundColor White
Write-Host "  API      → http://localhost:8080" -ForegroundColor White
Write-Host "  AI Svc   → http://localhost:8000" -ForegroundColor White
Write-Host "  Stop  → run stop.ps1" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor DarkGray
