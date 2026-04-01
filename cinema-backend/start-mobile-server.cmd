@echo off
setlocal

cd /d "%~dp0"
echo Opening Cinema backend in a new window...
start "Cinema Backend" cmd /k "cd /d %~dp0 && php -S 0.0.0.0:8000 -t public public/index.php"
exit /b 0
