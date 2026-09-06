@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Starting GrowFast Laundry Management System
echo ========================================================
echo.

echo 1. Cleaning up any stale processes on ports 3000 and 5173...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000, 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 } | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo [OK] Ports 3000 and 5173 are free.
echo.

echo 2. Starting PostgreSQL Database via Docker...
docker compose up -d
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start Docker container. Please ensure Docker Desktop is running.
    pause
    exit /b 1
)
echo [OK] PostgreSQL is running.
echo.

echo 3. Running Database Migrations...
call npm run db:migrate
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Database migration failed.
    pause
    exit /b 1
)
echo [OK] Migrations applied.
echo.

echo 4. Seeding Database...
call npm run db:seed
echo.

echo 5. Generating Prisma Client...
call npm run db:generate
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Prisma client generation failed.
    pause
    exit /b 1
)
echo [OK] Prisma Client ready.
echo.

echo 6. Starting Backend Server in background...
start "GrowFast Backend" cmd /k "npm run dev:backend"

echo Waiting for Backend to be ready on http://localhost:3000...
set /a ATTEMPTS=0

:WAIT_BACKEND
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 60 (
    echo.
    echo [ERROR] Backend failed to respond on http://localhost:3000 within 60 seconds.
    echo Please check the "GrowFast Backend" window for error messages.
    pause
    exit /b 1
)

ping -n 2 127.0.0.1 >nul
curl.exe -s -o NUL -w "%%{http_code}" http://127.0.0.1:3000/api/health 2>nul | findstr "200" >nul
if %errorlevel% neq 0 (
    echo   ... still starting backend (!ATTEMPTS!s)
    goto WAIT_BACKEND
)

echo [OK] Backend is ready and responding!
echo.

echo 7. Starting Frontend Server...
start "GrowFast Frontend" cmd /k "npm run dev:web"
echo [OK] Frontend is running!
echo.

echo ========================================================
echo   Application is running successfully!
echo   - Backend API:  http://localhost:3000/api
echo   - Frontend App: http://localhost:5173
echo ========================================================
echo.
pause
