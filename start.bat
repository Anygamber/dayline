@echo off
REM Dayline — local API on port 8001 (bind all interfaces for phone/emulator LAN).
REM Do NOT use 8000 (Optimusbot), 8010 (website), or 8080 (other local service).

cd /d "%~dp0"

if not exist ".venv\Scripts\uvicorn.exe" (
  echo [ERROR] .venv not found. Run:
  echo   python -m venv .venv
  echo   .venv\Scripts\pip install -r requirements.txt
  exit /b 1
)

echo Starting Dayline on http://0.0.0.0:8001
echo Local:  http://127.0.0.1:8001/
echo Docs:   http://127.0.0.1:8001/docs
echo Phone:  set EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8001
echo.
".venv\Scripts\uvicorn.exe" main:app --reload --host 0.0.0.0 --port 8001 --reload-dir .
