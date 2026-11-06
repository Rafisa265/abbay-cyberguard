@echo off
setlocal
title CyberShield Ethiopia — Offline Demonstration Server

echo ====================================================================
echo           CYBERSHIELD ETHIOPIA — COMPETITION DEMONSTRATION
echo ====================================================================
echo.
echo Starting CyberShield Ethiopia standalone offline demonstration...
echo Architecture: FastAPI Backend + Bundled Precompiled Trilingual SPA
echo Bind address: http://127.0.0.1:8000
echo.

cd /d "%~dp0backend"

REM Check for python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python was not found in your PATH.
    echo Please install Python 3.11 or higher to run the demo server.
    pause
    exit /b 1
)

REM Check if a virtualenv exists locally inside the package
if exist ".venv\Scripts\python.exe" (
    echo [INFO] Using package local environment from backend\.venv
    set "PY_EXE=.venv\Scripts\python.exe"
) else if exist "..\.venv\Scripts\python.exe" (
    echo [INFO] Using package environment from ..\.venv
    set "PY_EXE=..\.venv\Scripts\python.exe"
) else (
    echo [INFO] Checking system Python environment...
    set "PY_EXE=python"
)

REM Verify that the selected Python environment has required runtime dependencies
%PY_EXE% -c "import fastapi, uvicorn" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ====================================================================
    echo [BLOCKER] The Python environment [%PY_EXE%] is missing required packages:
    echo           - fastapi
    echo           - uvicorn
    echo           (See backend\requirements.txt)
    echo ====================================================================
    echo.
    echo To prepare a standalone environment for this package:
    echo   cd /d "%~dp0backend"
    echo   python -m venv .venv
    echo   call .venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo.
echo [INFO] Serving precompiled trilingual frontend and local API...
echo [INFO] Open your web browser to: http://127.0.0.1:8000
echo [INFO] Press CTRL+C or run stop-demo.bat to shut down cleanly.
echo.

%PY_EXE% run.py

pause
