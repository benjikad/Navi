@echo off
setlocal enabledelayedexpansion
title Navi Voice Assistant

echo ====================================
echo     Navi Voice Assistant Installer
echo ====================================
echo.

REM Check dependencies
echo [1/5] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git not found! Installing Git...
    start https://git-scm.com/downloads/win
    echo Please install Git and run this script again.
    pause
    exit /b 1
)
echo ✅ Git found

echo [2/5] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found! Opening download page...
    start https://nodejs.org/
    echo Please install Node.js and run this script again.
    pause
    exit /b 1
)
echo ✅ Node.js found

REM Project setup
set REPO_URL=https://github.com/benjikad/Navi.git
set TEMP_DIR=temp-navi-download

echo [3/5] Downloading/Updating Navi...

REM Check if we're already in a git repo
if exist ".git\" (
    echo Updating existing repository...
    git reset --hard HEAD >nul 2>&1
    git clean -fd >nul 2>&1
    git pull origin main
    if errorlevel 1 (
        echo Update failed, doing fresh download...
        goto :fresh_download
    )
) else (
    :fresh_download
    echo Fresh installation - downloading from GitHub...
    
    REM Clone to temp directory first
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    git clone %REPO_URL% %TEMP_DIR%
    if errorlevel 1 (
        echo ❌ Failed to download from GitHub!
        pause
        exit /b 1
    )
    
    REM Move everything from temp to current directory
    echo Moving files to current directory...
    xcopy "%TEMP_DIR%\*" "." /E /Y /Q >nul
    rmdir /s /q "%TEMP_DIR%"
    
    echo ✅ Repository downloaded to current directory
)

echo [4/5] Installing dependencies...
call npm install
if not exist "node_modules\" (
    echo ❌ Failed to install dependencies!
    pause
    exit /b 1
)
echo ✅ Dependencies installed

echo [5/5] Starting Navi...
if exist "index.js" (
    echo ✅ Found index.js - starting Navi...
    echo.
    node index.js
) else (
    echo ❌ index.js not found in repository!
    echo Please make sure index.js exists in your GitHub repo.
    pause
    exit /b 1
)

echo.
echo Navi has stopped.
pause
