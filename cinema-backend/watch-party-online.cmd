@echo off
setlocal

cd /d "%~dp0"

echo Starting Cinema backend in a new window...
start "Cinema Backend" cmd /k "cd /d %~dp0 && php -S 0.0.0.0:8000 -t public public/index.php"

echo Waiting for backend on http://127.0.0.1:8000 ...
powershell -NoProfile -Command "$ready=$false; 1..25 | ForEach-Object { try { & curl.exe -I --max-time 2 http://127.0.0.1:8000 > $null 2>&1; if ($LASTEXITCODE -eq 0) { $ready=$true; break } } catch {}; Start-Sleep -Seconds 1 }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
  echo Backend did not start in time.
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

if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" goto run_x86
if exist "C:\Program Files\cloudflared\cloudflared.exe" goto run_pf

echo cloudflared.exe not found.
echo Expected one of:
echo C:\Program Files (x86)\cloudflared\cloudflared.exe
echo C:\Program Files\cloudflared\cloudflared.exe
pause
exit /b 1

:run_x86
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8000 --no-autoupdate
exit /b %errorlevel%

:run_pf
"C:\Program Files\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8000 --no-autoupdate
exit /b %errorlevel%
