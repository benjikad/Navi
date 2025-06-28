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

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js isn't installed.
    start https://nodejs.org/
    pause
    exit /b 1
)

set REPO_URL=https://github.com/benjikad/Navi.git
set TEMP_DIR=tempnavi

if exist ".git\" (
    REM We're in a git repo, check if updates are available
    git fetch origin main >nul 2>&1
    
    REM Compare local and remote commit hashes
    for /f %%i in ('git rev-parse HEAD') do set LOCAL_HASH=%%i
    for /f %%i in ('git rev-parse origin/main') do set REMOTE_HASH=%%i
    
    if "!LOCAL_HASH!" neq "!REMOTE_HASH!" (
        git reset --hard HEAD >nul 2>&1
        git pull origin main >nul 2>&1
    )
) else (
    REM Not a git repo, do initial clone
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    git clone %REPO_URL% %TEMP_DIR% >nul 2>&1
    xcopy "%TEMP_DIR%\*" "." /E /Y /Q >nul 2>&1
    rmdir /s /q "%TEMP_DIR%" >nul 2>&1
    echo Installing Navi...
)

REM Run npm install only once after initial setup or if node_modules is missing
call npm install >nul 2>&1

REM Check if dependencies are installed
if not exist "node_modules\" (
    echo Dependencies aren't installed.
    pause
    exit /b 1
)

REM Run the application
if exist "index.js" (
    title Navi
    node index.js
) else (
    echo index.js isn't found.
    pause
    exit /b 1
)

pause
