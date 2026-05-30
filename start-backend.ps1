# FinSight — Start Backend with local env vars
# ─────────────────────────────────────────────────────────────────────────────
# Reads C:\Projects\finsight\.env.local and sets each KEY=VALUE as an
# environment variable before launching the Spring Boot dev server.
#
# Usage:
#   cd C:\Projects\finsight
#   .\start-backend.ps1
# ─────────────────────────────────────────────────────────────────────────────

$envFile = Join-Path $PSScriptRoot ".env.local"

if (Test-Path $envFile) {
    Write-Host "[FinSight] Loading env vars from .env.local..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        # Skip blank lines and comments
        if ($line -and -not $line.StartsWith('#')) {
            $parts = $line.Split('=', 2)
            if ($parts.Length -eq 2) {
                $key   = $parts[0].Trim()
                $value = $parts[1].Trim()
                [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
                Write-Host "  SET $key" -ForegroundColor DarkGray
            }
        }
    }
    Write-Host ""
} else {
    Write-Host "[FinSight] No .env.local found — using application.yml defaults." -ForegroundColor Yellow
    Write-Host "           Copy .env.local.example to .env.local to configure credentials.`n" -ForegroundColor Yellow
}

# Show active Plaid mode
$mode = [System.Environment]::GetEnvironmentVariable('PLAID_MODE', 'Process')
if (-not $mode) { $mode = 'mock (default)' }
Write-Host "[FinSight] PLAID_MODE = $mode" -ForegroundColor Green
Write-Host "[FinSight] Starting Spring Boot...`n" -ForegroundColor Green

# Launch the backend
Set-Location (Join-Path $PSScriptRoot "backend\portfolio-service")
& mvn spring-boot:run
