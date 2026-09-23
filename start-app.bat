@echo off
title GrowFast Laundry System
color 0B

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
cd /d "%ROOT_DIR%"

echo ===================================================
echo     GrowFast Laundry Management System Launcher
echo ===================================================
echo Project root: %ROOT_DIR%
echo.

:: ── Quick Check: If both backend and frontend are already active ──
netstat -ano | findstr "LISTENING" | findstr ":5173" >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto start_pg_check
netstat -ano | findstr "LISTENING" | findstr ":3000" >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto start_pg_check

color 0A
echo GrowFast Backend and Frontend are already running!
echo Opening http://localhost:5173 in your default browser...
start http://localhost:5173
ping 127.0.0.1 -n 3 >nul
exit /b 0

:: ── Step 1: PostgreSQL Check and Start ───────────────────────
:start_pg_check
echo [1/5] Checking PostgreSQL Database...
netstat -ano | findstr "LISTENING" | findstr ":5433" >nul 2>&1
if %ERRORLEVEL% EQU 0 goto db_active

echo       PostgreSQL is not listening on port 5433.
echo       Checking Docker daemon status...
docker ps >nul 2>&1
if %ERRORLEVEL% EQU 0 goto run_compose

echo       Docker daemon not responding. Attempting to start Docker Desktop...
if exist "%USERPROFILE%\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe" start "" "%USERPROFILE%\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo       Waiting for Docker daemon to become ready...
set DOCKER_WAIT=0
:docker_poll
set /a DOCKER_WAIT+=1
if %DOCKER_WAIT% GTR 30 goto docker_failed
ping 127.0.0.1 -n 3 >nul
docker ps >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto docker_poll
echo       Docker daemon is now ready!
goto run_compose

:docker_failed
color 0C
echo.
echo ERROR: Docker daemon did not start in time.
echo Please start Docker Desktop manually, then re-run start-app.bat.
echo.
pause
exit /b 1

:run_compose
echo       Starting PostgreSQL container via Docker Compose...
docker compose up -d
if %ERRORLEVEL% NEQ 0 goto compose_failed

echo       Waiting for PostgreSQL on port 5433...
set DB_WAIT=0
:db_poll
set /a DB_WAIT+=1
if %DB_WAIT% GTR 30 goto pg_timeout
ping 127.0.0.1 -n 2 >nul
netstat -ano | findstr "LISTENING" | findstr ":5433" >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto db_poll
goto db_active

:compose_failed
color 0C
echo.
echo ERROR: Failed to start PostgreSQL container.
echo.
pause
exit /b 1

:pg_timeout
color 0C
echo.
echo ERROR: PostgreSQL did not respond on port 5433 in 30 seconds.
echo Check Docker logs with: docker compose logs postgres
echo.
pause
exit /b 1

:db_active
echo       PostgreSQL is active!
echo.

:: ── Step 2: Prisma Client and Database Migrations ────────────
echo [2/5] Checking Prisma Client and Database Migrations...
call npx.cmd prisma generate --schema=prisma/schema.prisma >nul 2>&1
if %ERRORLEVEL% EQU 0 goto prisma_ready
if exist "node_modules\@prisma\client\index.js" goto prisma_reused

echo       Retrying Prisma client generation...
call npx.cmd prisma generate --schema=prisma/schema.prisma
if %ERRORLEVEL% NEQ 0 goto prisma_failed
goto prisma_ready

:prisma_reused
echo       Using existing generated Prisma client (file lock bypassed).
goto run_migrations

:prisma_ready
echo       Prisma client ready.
goto run_migrations

:prisma_failed
color 0C
echo ERROR: Prisma client generation failed.
pause
exit /b 1

:run_migrations
call npx.cmd prisma migrate deploy --schema=prisma/schema.prisma
if %ERRORLEVEL% EQU 0 goto migrations_ready

echo       Applying database migrations via migrate dev...
call npx.cmd prisma migrate dev --schema=prisma/schema.prisma --skip-generate
if %ERRORLEVEL% NEQ 0 goto migrations_failed

:migrations_ready
echo       Database migrations verified.
echo.
goto check_seed

:migrations_failed
color 0C
echo ERROR: Database migration failed.
pause
exit /b 1

:: ── Step 3: Fast Database Seed Check ─────────────────────────
:check_seed
echo [3/5] Verifying Database Initial Data...
node scripts/check-db-seeded.js >nul 2>&1
if %ERRORLEVEL% EQU 0 goto seed_done

echo       Initial setup: Seeding development database...
call npx.cmd tsx prisma/seed.ts
if %ERRORLEVEL% NEQ 0 echo       WARNING: Seed had non-critical notices. Continuing...

:seed_done
echo       Database ready.
echo.

:: ── Step 4: Launch Backend and Frontend Servers ──────────────
echo [4/5] Launching Application Servers...

:: Launch Backend if not already running
netstat -ano | findstr "LISTENING" | findstr ":3000" >nul 2>&1
if %ERRORLEVEL% EQU 0 goto backend_already_running

echo       Starting Backend Server (NestJS on port 3000)...
start "GrowFast Backend (port 3000)" /d "%ROOT_DIR%" cmd /k "npm run dev:backend"
goto check_frontend_launch

:backend_already_running
echo       Backend is already running on port 3000.

:check_frontend_launch
:: Launch Frontend if not already running
netstat -ano | findstr "LISTENING" | findstr ":5173" >nul 2>&1
if %ERRORLEVEL% EQU 0 goto frontend_already_running

echo       Starting Frontend Server (Vite on port 5173)...
start "GrowFast Frontend (port 5173)" /d "%ROOT_DIR%" cmd /k "npm run dev:web"
goto servers_launched

:frontend_already_running
echo       Frontend is already running on port 5173.

:servers_launched
echo.

:: ── Step 5: Wait for Services and Launch Browser ─────────────
echo [5/5] Waiting for services to become ready...

echo       Waiting for Backend on port 3000...
set BE_POLL=0
:wait_be_ready
set /a BE_POLL+=1
if %BE_POLL% GTR 60 goto backend_poll_timeout
netstat -ano | findstr "LISTENING" | findstr ":3000" >nul 2>&1
if %ERRORLEVEL% EQU 0 goto be_is_ready
echo       Waiting for Backend to compile and start (%BE_POLL%/60)...
ping 127.0.0.1 -n 2 >nul
goto wait_be_ready

:backend_poll_timeout
echo       WARNING: Backend took longer than 60s. Proceeding to frontend...
goto wait_fe_check

:be_is_ready
echo       [OK] Backend is listening on http://localhost:3000/api

:wait_fe_check
echo       Waiting for Frontend on port 5173...
set FE_POLL=0
:wait_fe_ready
set /a FE_POLL+=1
if %FE_POLL% GTR 30 goto frontend_poll_timeout
netstat -ano | findstr "LISTENING" | findstr ":5173" >nul 2>&1
if %ERRORLEVEL% EQU 0 goto fe_is_ready
echo       Waiting for Frontend to compile (%FE_POLL%/30)...
ping 127.0.0.1 -n 2 >nul
goto wait_fe_ready

:frontend_poll_timeout
echo       WARNING: Frontend took longer than 30s. Opening browser...
goto open_app

:fe_is_ready
echo       [OK] Frontend is listening on http://localhost:5173

:open_app
echo.
echo       Opening GrowFast Laundry System in your web browser...
start http://localhost:5173

echo.
color 0A
echo ===================================================
echo   GrowFast Laundry System is RUNNING!
echo ===================================================
echo.
echo   Application URL:  http://localhost:5173
echo   Backend API:      http://localhost:3000/api
echo.
echo   Login Credentials (PIN):
echo     Owner:     111111
echo     Manager:   222222
echo     Counter:   333333
echo     Delivery:  444444
echo.
echo   Keep the two server terminal windows open while
echo   working. Close them to stop the application.
echo ===================================================
echo.
pause
