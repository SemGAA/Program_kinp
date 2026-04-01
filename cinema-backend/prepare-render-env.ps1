$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "1. Скопируйте этот APP_KEY в Render:"
php artisan key:generate --show

Write-Host ""
Write-Host "2. Заполните в Render также:"
Write-Host "   APP_URL=https://<your-render-service>.onrender.com"
Write-Host "   TMDB_API_KEY=<your_tmdb_key>"
Write-Host "   HF_TOKEN=<optional>"
Write-Host ""
Write-Host "3. Шаблон env лежит в:"
Write-Host "   $PSScriptRoot\\.env.render.example"
