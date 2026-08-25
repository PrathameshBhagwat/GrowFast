@echo off
echo Starting GrowFast Laundry Management System...
echo.

echo 1. Starting PostgreSQL Database via Docker...
docker compose up -d
echo.

echo 2. Running Database Migrations...
call npm run db:migrate
echo.

echo 3. Generating Prisma Client...
call npm run db:generate
echo.

echo 4. Starting Backend and Frontend Servers...
echo (Two new command windows will open for the servers)
start "GrowFast Backend" cmd /c "npm run dev:backend"
start "GrowFast Frontend" cmd /c "npm run dev:web"

echo.
echo Application is starting! 
echo - Backend will be available at: http://localhost:3000
echo - Frontend will be available at: http://localhost:5173
echo.
pause
