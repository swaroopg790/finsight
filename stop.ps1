# FinSight — stop all services
# Usage: right-click → "Run with PowerShell"  OR  tell Claude "stop the app"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

$ROOT = $PSScriptRoot

function Write-Step($msg) { Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }

# Kill backend (port 8080)
Write-Step "Stopping backend..."
$conn = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  Write-Ok "Backend stopped"
} else { Write-Ok "Backend was not running" }

# Kill AI service (port 8000)
Write-Step "Stopping AI service..."
$conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  Write-Ok "AI service stopped"
} else { Write-Ok "AI service was not running" }

# Kill frontend (port 5173)
Write-Step "Stopping frontend..."
$conn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  Write-Ok "Frontend stopped"
} else { Write-Ok "Frontend was not running" }

# Stop Docker containers (keeps your data)
Write-Step "Stopping Docker containers..."
docker compose -f "$ROOT\infrastructure\docker-compose.yml" stop 2>&1 | Out-Null
Write-Ok "Postgres + Redis stopped (data preserved)"

Write-Host "`n  FinSight stopped. Run start.ps1 to start again.`n" -ForegroundColor DarkGray
