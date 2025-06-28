@echo off
setlocal enabledelayedexpansion
title Navi Voice Agent

REM Check if Git exists
git --version >nul 2>&1
if errorlevel 1 (
    echo Git is not installed! Please install Git from https://git-scm.com/downloads/win
    start https://git-scm.com/downloads/win
    pause
    exit /b 1
)

REM Check if Node.js exists
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found! Please install Node.js first.
    echo Opening Node.js download page...
    start https://nodejs.org/
    pause
    exit /b 1
)

REM Set project details
set REPO_URL=https://github.com/benjikad/Navi.git
set PROJECT_DIR=Navi-Project

REM Check if project exists, clone or update
if exist "%PROJECT_DIR%" (
    echo Navi found. Checking for updates...
    cd "%PROJECT_DIR%"
    
    REM Check if we're in a git repository
    git status >nul 2>&1
    if errorlevel 1 (
        echo Project folder corrupted. Re-downloading...
        cd ..
        rmdir /s /q "%PROJECT_DIR%"
        goto :clone
    ) else (
        echo Pulling latest updates...
        git pull origin main
        if errorlevel 1 (
            echo Update failed! Continuing with current version...
        )
    )
) else (
    :clone
    echo Downloading Navi from GitHub...
    git clone %REPO_URL% %PROJECT_DIR%
    if errorlevel 1 (
        echo Failed to download Navi!
        pause
        exit /b 1
    )
    cd "%PROJECT_DIR%"
)

REM Install/update dependencies
echo Checking dependencies...
if not exist "node_modules\" (
    echo Installing dependencies for first time...
    echo This may take a few minutes...
    call npm install
    if exist "node_modules\" (
        echo Dependencies installed successfully!
    ) else (
        echo ERROR: npm install failed - node_modules not created
        pause
        exit /b 1
    )
) else (
    echo node_modules exists, checking for updates...
    call npm install >nul 2>&1
    echo Dependencies checked.
)

REM Run Navi
echo.
echo Starting Navi Voice Agent...
echo ===========================
if exist "index.js" (
    node index.js
) else (
    echo ERROR: index.js not found!
    echo Creating a basic index.js for testing...
    echo console.log("Navi Voice Assistant - Basic test"); > index.js
    echo console.log("index.js created successfully!"); >> index.js
    echo setTimeout(() => { console.log("Navi is ready!"); }, 1000); >> index.js
    node index.js
)

echo.
echo Navi finished running.
pause
