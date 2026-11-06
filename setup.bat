@echo off
REM One-time setup (Windows). Requires Python 3.11+ and Node.js 20+.
cd /d "%~dp0backend"
python -m venv .venv || exit /b 1
call .venv\Scripts\pip install -r requirements.txt -r requirements-dev.txt || exit /b 1
cd /d "%~dp0frontend"
call npm ci || exit /b 1
call npm run build || exit /b 1
echo Setup complete. Run start.bat