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
if not exist "node_modules" (
    echo Installing dependencies for first time...
    npm install
    if errorlevel 1 (
        echo Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo Checking for dependency updates...
    npm install >nul 2>&1
)

REM Run Navi
echo Starting Navi Voice Agent...
echo ===========================
node index.js

REM Keep window open if there's an error
if errorlevel 1 (
    echo.
    echo Navi exited with an error!
    pause
)

pause
