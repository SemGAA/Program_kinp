@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0tunnel-backend.ps1" %*
