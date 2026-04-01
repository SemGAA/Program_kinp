@echo off
setlocal

cd /d "%~dp0"
node "%~dp0scripts\watch-party-online.mjs"
exit /b %errorlevel%
