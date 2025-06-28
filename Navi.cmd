@echo off
echo Starting Voice Agent Setup...

REM Check if Node.js exists
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found! Please install Node.js first.
    echo Opening Node.js download page...
    start https://nodejs.org/
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Check for updates (optional)
echo Checking for updates...
git pull origin main

REM Run the application
echo Starting Voice Agent...
node index.js
pause
