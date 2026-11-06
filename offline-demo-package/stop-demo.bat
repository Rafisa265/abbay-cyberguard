@echo off
setlocal
title CyberShield Ethiopia — Stop Demo Server

echo ====================================================================
echo           CYBERSHIELD ETHIOPIA — STOPPING DEMO SERVER
echo ====================================================================
echo.

cd /d "%~dp0"

if not exist "demo_server.pid" (
    echo [INFO] No demo_server.pid file found.
    echo CyberShield standalone demo server is not currently running.
    echo (Will not terminate any other processes or servers.)
    timeout /t 2 >nul
    exit /b 0
)

set /p DEMO_PID=<"demo_server.pid"
if "%DEMO_PID%"=="" (
    echo [WARN] demo_server.pid is empty.
    del "demo_server.pid" >nul 2>&1
    exit /b 0
)

echo [INFO] Stopping CyberShield demo server process (PID: %DEMO_PID%)...
taskkill /F /PID %DEMO_PID% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Demo server process %DEMO_PID% stopped cleanly.
) else (
    echo [INFO] Process %DEMO_PID% was already stopped or not running.
)

if exist "demo_server.pid" del "demo_server.pid" >nul 2>&1
echo [INFO] Shutdown complete.
timeout /t 2 >nul
exit /b 0

