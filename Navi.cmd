@echo off
setlocal enabledelayedexpansion
title "Starting Navi"

REM Check if Git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo Git isn't installed.
    start https://git-scm.com/downloads/win
    pause
    exit /b 1
)

REM Check if Python is installed
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
    echo Pulling latest updates...
    git pull origin main
    if errorlevel 1 (
        echo Failed to pull updates. Continuing with current version...
    ) else (
        echo Navi updated successfully!
    )
) else (
    echo Downloading Navi...
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    git clone %REPO_URL% %TEMP_DIR% >nul 2>&1
    xcopy "%TEMP_DIR%\*" "." /E /Y /Q >nul 2>&1
    rmdir /s /q "%TEMP_DIR%" >nul 2>&1
    echo Installing Navi...
)

REM Run the program
if exist "main.py" (
    title "Navi - AI Voice Assistant"
    echo Starting Navi...
    python main.py
) else (
    echo main.py isn't found.
    pause
    exit /b 1
)
pause
