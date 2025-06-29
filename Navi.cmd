@echo off
setlocal enabledelayedexpansion
title Starting Navi

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
    echo Checking for updates...
    git fetch origin main >nul 2>&1
    
    for /f %%i in ('git rev-parse HEAD') do set LOCAL_HASH=%%i
    for /f %%i in ('git rev-parse origin/main') do set REMOTE_HASH=%%i
    
    if "!LOCAL_HASH!" neq "!REMOTE_HASH!" (
        echo Updating Navi...
        
        REM Clean everything except Navi.cmd, then download fresh
        echo Cleaning all files...
        for %%f in (*) do (
            if /i not "%%f"=="Navi.cmd" (
                if exist "%%f" del /q "%%f" >nul 2>&1
            )
        )
        for /d %%d in (*) do (
            if exist "%%d" rmdir /s /q "%%d" >nul 2>&1
        )
        
        REM Download fresh copy
        echo Downloading latest version...
        if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
        git clone %REPO_URL% %TEMP_DIR% >nul 2>&1
        xcopy "%TEMP_DIR%\*" "." /E /Y /Q >nul 2>&1
        rmdir /s /q "%TEMP_DIR%" >nul 2>&1
        echo Navi updated successfully!
    ) else (
        echo Navi is up to date.
    )
) else (
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
