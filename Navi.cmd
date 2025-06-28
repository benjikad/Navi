@echo off
setlocal enabledelayedexpansion
title Starting Navi

git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git not found! Installing Git...
    start https://git-scm.com/downloads/win
    echo Please install Git and run this script again.
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found! Opening download page...
    start https://nodejs.org/
    echo Please install Node.js and run this script again.
    pause
    exit /b 1
)

set REPO_URL=https://github.com/benjikad/Navi.git
set TEMP_DIR=temp-navi-download

echo Installing Navi...

if exist ".git\" (
    git reset --hard HEAD >nul 2>&1
    git clean -fd >nul 2>&1
    git pull origin main
    if errorlevel 1 (
        echo Update failed...
        goto :fresh_download
    )
) else (
    :fresh_download
    
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    git clone %REPO_URL% %TEMP_DIR%
    if errorlevel 1 (
        echo Failed to download!
        pause
        exit /b 1
    )
    
    echo Moving files to current directory...
    xcopy "%TEMP_DIR%\*" "." /E /Y /Q >nul
    rmdir /s /q "%TEMP_DIR%"
    
    echo Successfully installed!
)

call npm install
if not exist "node_modules\" (
    echo Failed to install dependencies!
    pause
    exit /b 1
)

echo Starting Navi...
if exist "index.js" (
    echo.
    node index.js
) else (
    echo index.js not found in repository!
    echo Please make sure index.js exists in your GitHub repo.
    pause
    exit /b 1
)

echo.
echo Navi has stopped.
pause
