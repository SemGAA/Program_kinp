@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0stop-public-backend.ps1" %*
