@echo off
setlocal enabledelayedexpansion
title Starting Navi

REM Check for Git
git --version >nul 2>&1
if errorlevel 1 (
    echo Git isn't installed.
    start https://git-scm.com/downloads/win
    pause
    exit /b 1
)

REM Check for Python (required for Whisper dependencies)
python --version >nul 2>&1
if errorlevel 1 (
    echo Python isn't installed.
    echo Please install Python from: https://www.python.org/downloads/
    start https://www.python.org/downloads/
    pause
    exit /b 1
)

set REPO_URL=https://github.com/benjikad/Navi.git
set TEMP_DIR=tempnavi

if exist ".git\" (
    REM We're in a git repo, check if updates are available
    echo Checking for updates...
    git fetch origin main >nul 2>&1
    
    REM Compare local and remote commit hashes
    for /f %%i in ('git rev-parse HEAD') do set LOCAL_HASH=%%i
    for /f %%i in ('git rev-parse origin/main') do set REMOTE_HASH=%%i
    
    if "!LOCAL_HASH!" neq "!REMOTE_HASH!" (
        echo Updating Navi...
        git reset --hard HEAD >nul 2>&1
        git pull origin main >nul 2>&1
    )
) else (
    REM Not a git repo, do initial clone
    echo Downloading Navi...
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    git clone %REPO_URL% %TEMP_DIR% >nul 2>&1
    xcopy "%TEMP_DIR%\*" "." /E /Y /Q >nul 2>&1
    rmdir /s /q "%TEMP_DIR%" >nul 2>&1
    echo Installing Navi...
)

if exist "main.py" (
    title Navi - AI Voice Assistant
    echo Starting Navi...
    python main.py
) else (
    echo main.py isn't found.
    pause
    exit /b 1
)

pause
