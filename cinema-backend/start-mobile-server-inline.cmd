@echo off
setlocal

cd /d "%~dp0"
php -S 0.0.0.0:8000 -t public public/index.php
