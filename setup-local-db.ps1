# ARTIC VMS - Local Database Setup (No Docker Required)
# Run this script as Administrator in PowerShell
# Right-click PowerShell -> "Run as Administrator", then:
#   cd "d:\Projectts 2026\SANO IRENE\New folder (2)"
#   .\setup-local-db.ps1

Write-Host "=== ARTIC VMS Local Database Setup ===" -ForegroundColor Cyan

# ─── Check if PostgreSQL is already running ───────────────────────────────────
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    Write-Host "PostgreSQL is already running." -ForegroundColor Green
} else {
    Write-Host "Installing PostgreSQL via winget..." -ForegroundColor Yellow
    winget install -e --id PostgreSQL.PostgreSQL.16 --accept-source-agreements --accept-package-agreements
    Write-Host "PostgreSQL installed. Starting service..." -ForegroundColor Yellow
    Start-Service -Name "postgresql*" -ErrorAction SilentlyContinue
}

# ─── Create database and user ─────────────────────────────────────────────────
Write-Host "Creating database 'artic_vms' and user 'artic'..." -ForegroundColor Yellow

$pgPath = "C:\Program Files\PostgreSQL\16\bin"
if (-not (Test-Path $pgPath)) {
    $pgPath = (Get-Item "C:\Program Files\PostgreSQL\*\bin" -ErrorAction SilentlyContinue | Select-Object -Last 1).FullName
}

if ($pgPath) {
    $env:PGPASSWORD = "postgres"
    & "$pgPath\psql.exe" -U postgres -c "CREATE USER artic WITH PASSWORD 'artic_secret';" 2>$null
    & "$pgPath\psql.exe" -U postgres -c "CREATE DATABASE artic_vms OWNER artic;" 2>$null
    & "$pgPath\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE artic_vms TO artic;" 2>$null
    Write-Host "Database setup complete." -ForegroundColor Green
} else {
    Write-Host "Could not find psql.exe. Please create the database manually." -ForegroundColor Red
    Write-Host "  1. Open pgAdmin or psql as postgres user" -ForegroundColor White
    Write-Host "  2. Run: CREATE USER artic WITH PASSWORD 'artic_secret';" -ForegroundColor White
    Write-Host "  3. Run: CREATE DATABASE artic_vms OWNER artic;" -ForegroundColor White
}

# ─── Redis (using Memurai - Redis-compatible for Windows) ─────────────────────
$redisService = Get-Service -Name "Redis*" -ErrorAction SilentlyContinue
$memuraiService = Get-Service -Name "Memurai*" -ErrorAction SilentlyContinue

if (($redisService -and $redisService.Status -eq "Running") -or ($memuraiService -and $memuraiService.Status -eq "Running")) {
    Write-Host "Redis/Memurai is already running." -ForegroundColor Green
} else {
    Write-Host "Installing Memurai (Redis-compatible for Windows)..." -ForegroundColor Yellow
    winget install -e --id Memurai.Memurai --accept-source-agreements --accept-package-agreements 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Memurai not found via winget. Trying Redis for Windows..." -ForegroundColor Yellow
        # Alternative: download Redis Windows port
        Write-Host "Please install Redis manually from: https://github.com/tporadowski/redis/releases" -ForegroundColor White
        Write-Host "Or use: winget install -e --id tporadowski.redis" -ForegroundColor White
        winget install -e --id tporadowski.redis --accept-source-agreements --accept-package-agreements 2>$null
    }
    Start-Service -Name "Redis*" -ErrorAction SilentlyContinue
    Start-Service -Name "Memurai*" -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host "PostgreSQL: localhost:5432  (user: artic, pass: artic_secret, db: artic_vms)" -ForegroundColor White
Write-Host "Redis:      localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  npx prisma migrate dev" -ForegroundColor White
Write-Host "  npm run seed" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
