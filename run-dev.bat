@echo off
echo =============================================
echo   AI Agent Desktop Pet - MapleStory Cat
echo =============================================
echo.

set NODE_ENV=development

echo [1/2] Starting Vite dev server...
start "Vite Server" /MIN cmd /c "npx vite --port 5173"

echo.
echo Waiting for dev server to start (6 seconds)...
timeout /t 6 /nobreak > nul

echo [2/2] Launching AI Pet app...
npx electron .

echo.
echo App closed.
taskkill /F /FI "WINDOWTITLE eq Vite Server*" > nul 2>&1
pause
