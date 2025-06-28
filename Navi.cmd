@echo off
setlocal enabledelayedexpansion
title Starting Navi

git --version >nul 2>&1
if errorlevel 1 (
    echo Git isn't installed.
    start https://git-scm.com/downloads/win
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js isn't installed.
    start https://nodejs.org/
    pause
    exit /b 1
)

set REPO_URL=https://github.com/benjikad/Navi.git
set TEMP_DIR=tempnavi

echo Installing Navi...

if exist ".git\" (
    git reset --hard HEAD >nul 2>&1
    git pull origin main >nul 2>&1
) else (
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    git clone %REPO_URL% %TEMP_DIR% >nul 2>&1
    xcopy "%TEMP_DIR%\*" "." /E /Y /Q >nul 2>&1
    rmdir /s /q "%TEMP_DIR%" >nul 2>&1
)

call npm install >nul 2>&1
if not exist "node_modules\" (
    echo Dependencies aren't installed.
    pause
    exit /b 1
)

if exist "index.js" (
    node index.js
) else (
    echo index.js isn't found.
    pause
    exit /b 1
)

pause
