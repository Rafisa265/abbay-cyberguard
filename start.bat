@echo off
REM Start the API for local-only Windows inspection on http://127.0.0.1:8000
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo Python environment is missing. Run setup.bat once, then retry start.bat.
  exit /b 1
)
set "CYBERSHIELD_BIND=127.0.0.1"
set "CYBERSHIELD_PORT=8000"
set "CYBERSHIELD_ALLOW_NON_LOOPBACK=false"
echo Starting the local-only service at http://127.0.0.1:8000
echo Keep this window open while using Windows Device Security.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-DeviceSecurityService.ps1" -RunInConsole
exit /b %errorlevel%
