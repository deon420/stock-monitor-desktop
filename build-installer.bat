@echo off
echo Building Stock Monitor Installer...
echo.

echo Step 1: Installing main dependencies...
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%

echo Step 2: Building frontend...
call npm run build  
if %errorlevel% neq 0 exit /b %errorlevel%

echo Step 3: Installing desktop dependencies...
cd desktop-app
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%

echo Step 4: Building Windows installer...
call npm run build-win
if %errorlevel% neq 0 exit /b %errorlevel%

echo.
echo ✅ SUCCESS! Your playful installer is ready:
echo    desktop-app\dist\StockMonitor-Setup-1.0.0.exe
echo.
pause