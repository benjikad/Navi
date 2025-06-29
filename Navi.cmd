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
set COMMIT_FILE=.navi_commit

REM Get the latest commit hash from remote repository
echo Checking for updates...
for /f "tokens=1" %%i in ('git ls-remote %REPO_URL% HEAD 2^>nul') do set REMOTE_COMMIT=%%i

if "%REMOTE_COMMIT%"=="" (
    echo Failed to check remote repository. Continuing with current version...
    goto :run_program
)

REM Check if we have a stored commit hash
set LOCAL_COMMIT=
if exist "%COMMIT_FILE%" (
    set /p LOCAL_COMMIT=<"%COMMIT_FILE%"
)

REM Compare commits
if "%LOCAL_COMMIT%"=="%REMOTE_COMMIT%" (
    echo No updates available. Current version is up to date.
    goto :run_program
) else (
    if "%LOCAL_COMMIT%"=="" (
        echo Downloading Navi...
    ) else (
        echo Update available! Local: %LOCAL_COMMIT:~0,8% Remote: %REMOTE_COMMIT:~0,8%
        echo Downloading latest version...
    )
)

REM Check if current directory is a Git repository (check for .git directory)
if exist ".git" (
    echo Found existing Git repository. Checking for updates...
    
    REM Verify this is the correct repository
    for /f "tokens=*" %%i in ('git config --get remote.origin.url 2^>nul') do set CURRENT_REPO=%%i
    
    if "!CURRENT_REPO!"=="%REPO_URL%" (
        echo Pulling...
        git pull origin main
        if errorlevel 1 (
            echo Failed to pull updates. Continuing with current version...
        ) else (
            echo Navi updated successfully!
        )
    ) else (
        echo Warning: Current directory is a Git repository but not the Navi repository.
        echo Current repo: !CURRENT_REPO!
        echo Expected repo: %REPO_URL%
        echo Continuing with current version...
    )
) else (
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    
    echo Cloning...
    git clone %REPO_URL% %TEMP_DIR%
    if errorlevel 1 (
        echo Failed to clone repository. Please check your internet connection.
        pause
        exit /b 1
    )
    
    echo Installing...
    xcopy "%TEMP_DIR%\*" "." /E /Y /Q >nul 2>&1
    if errorlevel 1 (
        echo Failed to copy files.
        pause
        exit /b 1
    )
    
    rmdir /s /q "%TEMP_DIR%" >nul 2>&1
    
    echo %REMOTE_COMMIT%>"%COMMIT_FILE%"
    echo Navi is ready,
    pause
)

REM Run the program
:run_program
if exist "main.py" (
    title "Navi - AI Voice Assistant"
    echo Starting Navi...
    python main.py
) else (
    echo Error: main.py not found in current directory.
    echo Please ensure you're running this script from the correct location.
    pause
    exit /b 1
)

pause
