@echo off
setlocal enabledelayedexpansion
title Starting Navi

echo Starting Navi installer...
echo Current directory: %CD%

echo Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo Git not found! Installing Git...
    start https://git-scm.com/downloads/win
    echo Please install Git and run this script again.
    pause
    exit /b 1
) else (
    echo Git found!
)

echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found! Opening download page...
    start https://nodejs.org/
    echo Please install Node.js and run this script again.
    pause
    exit /b 1
) else (
    echo Node.js found!
)

set REPO_URL=https://github.com/benjikad/Navi.git
set TEMP_DIR=temp-navi-download

echo Installing Navi...
echo Checking for existing .git folder...

if exist ".git\" (
    echo Found existing git repository, updating...
    git reset --hard HEAD
    echo Reset complete, pulling updates...
    git pull origin main
    if errorlevel 1 (
        echo Update failed, doing fresh download...
        goto :fresh_download
    ) else (
        echo Update successful!
    )
) else (
    echo No git repository found, doing fresh download...
    goto :fresh_download
)

goto :install_deps

:fresh_download
echo Starting fresh download...
if exist "%TEMP_DIR%" (
    echo Removing existing temp directory...
    rmdir /s /q "%TEMP_DIR%"
)

echo Cloning repository...
git clone %REPO_URL% %TEMP_DIR%
if errorlevel 1 (
    echo Failed to download from GitHub!
    echo Error code: %errorlevel%
    pause
    exit /b 1
) else (
    echo Clone successful!
)

echo Moving files to current directory...
xcopy "%TEMP_DIR%\*" "." /E /Y /Q
if errorlevel 1 (
    echo Failed to copy files!
    echo Error code: %errorlevel%
    pause
    exit /b 1
) else (
    echo Files moved successfully!
)

echo Cleaning up temp directory...
rmdir /s /q "%TEMP_DIR%"
echo Fresh download complete!

:install_deps
echo Installing npm dependencies...
call npm install
if errorlevel 1 (
    echo npm install returned error code: %errorlevel%
    echo But checking if node_modules exists anyway...
)

if not exist "node_modules\" (
    echo Failed to install dependencies - node_modules not found!
    pause
    exit /b 1
) else (
    echo Dependencies installed successfully!
)

echo Starting Navi...
if exist "index.js" (
    echo Found index.js, starting application...
    echo.
    node index.js
    echo.
    echo Node.js exited with code: %errorlevel%
) else (
    echo ERROR: index.js not found!
    echo Contents of current directory:
    dir
    pause
    exit /b 1
)

echo.
echo Navi has stopped.
pause
