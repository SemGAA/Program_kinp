@echo off
setlocal

cd /d "%~dp0"

echo Starting Cinema backend in a new window...
start "Cinema Backend" powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0start-mobile-server.ps1" -Inline

echo Waiting for backend on http://127.0.0.1:8000 ...
powershell -NoProfile -Command "$ready=$false; 1..25 | ForEach-Object { try { Invoke-WebRequest 'http://127.0.0.1:8000' -TimeoutSec 2 | Out-Null; $ready=$true; break } catch { Start-Sleep -Seconds 1 } }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
  echo Backend did not start in time.
  pause
  exit /b 1
)

set "CF_BIN=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not exist "%CF_BIN%" set "CF_BIN=C:\Program Files\cloudflared\cloudflared.exe"

if not exist "%CF_BIN%" (
  echo cloudflared.exe not found.
  echo Expected path:
  echo C:\Program Files (x86)\cloudflared\cloudflared.exe
  pause
  exit /b 1
)

echo.
echo Backend is ready.
echo Starting public Cloudflare tunnel...
echo.
echo Copy the https://....trycloudflare.com URL from this window.
echo In the app, use:
echo https://....trycloudflare.com/api
echo.

"%CF_BIN%" tunnel --url http://127.0.0.1:8000 --no-autoupdate

endlocal
