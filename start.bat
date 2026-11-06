@echo off
REM Single start command: serves the built app + API on http://127.0.0.1:8000
cd /d "%~dp0backend"
.venv\Scripts\python run.py
