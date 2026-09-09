@echo off
title GrowFast Launcher
color 0B
echo ============================================
echo   GrowFast Laundry Management System
echo   Starting Application...
echo ============================================
echo.

:: ── Step 1: Start PostgreSQL via Docker ─────────────────────
echo [1/6] Starting PostgreSQL Database via Docker...
docker compose up -d
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo ERROR: Docker failed to start. Make sure Docker Desktop is running.
    echo.
    pause
    exit /b 1
)
echo       Docker container started.
echo.

:: ── Step 2: Wait for PostgreSQL to be healthy ───────────────
echo [2/6] Waiting for PostgreSQL to be ready...
set RETRIES=0
:wait_db
set /a RETRIES+=1
if %RETRIES% GTR 30 (
    color 0C
    echo.
    echo ERROR: PostgreSQL did not become ready in 30 seconds.
    echo       Check Docker logs: docker compose logs postgres
    echo.
    pause
    exit /b 1
)
docker compose exec -T postgres pg_isready -U growfast -d growfast_laundry >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo       Attempt %RETRIES%/30 - waiting...
    timeout /t 1 /nobreak >nul
    goto wait_db
)
echo       PostgreSQL is ready!
echo.

:: ── Step 3: Generate Prisma Client ──────────────────────────
echo [3/6] Generating Prisma Client...
call npx prisma generate --schema=prisma/schema.prisma
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo ERROR: Prisma client generation failed.
    echo.
    pause
    exit /b 1
)
echo       Prisma client generated.
echo.

:: ── Step 4: Run Database Migrations ─────────────────────────
echo [4/6] Running Database Migrations...
call npx prisma migrate deploy --schema=prisma/schema.prisma
if %ERRORLEVEL% NEQ 0 (
    echo       migrate deploy failed, trying migrate dev...
    call npx prisma migrate dev --schema=prisma/schema.prisma --skip-generate
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo.
        echo ERROR: Database migration failed.
        echo.
        pause
        exit /b 1
    )
)
echo       Migrations applied.
echo.

:: ── Step 5: Seed Database (idempotent — safe to re-run) ─────
echo [5/6] Seeding Database...
call npx tsx prisma/seed.ts
if %ERRORLEVEL% NEQ 0 (
    echo       WARNING: Seed script had issues, but continuing...
    echo       (This is normal if data already exists)
)
echo       Seeding complete.
echo.

:: ── Step 6: Start Backend and Frontend ──────────────────────
echo [6/6] Starting Backend and Frontend Servers...
echo.

:: Start backend in a new window (cmd /k keeps it open on error)
start "GrowFast Backend (port 3000)" cmd /k "cd /d %~dp0 && npm run dev:backend"

:: Wait a few seconds for backend to boot before starting frontend
echo       Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

:: Start frontend in a new window
start "GrowFast Frontend (port 5173)" cmd /k "cd /d %~dp0 && npm run dev:web"

echo.
color 0A
echo ============================================
echo   GrowFast is running!
echo ============================================
echo.
echo   Backend:   http://localhost:3000/api
echo   Frontend:  http://localhost:5173
echo.
echo   Two server windows have opened.
echo   Keep them open while using the app.
echo   Close them to stop the servers.
echo.
echo ============================================
echo.
pause
