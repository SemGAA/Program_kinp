@echo off
setlocal

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0start-mobile-server.ps1"
exit /b %errorlevel%
