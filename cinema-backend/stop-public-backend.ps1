param()

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$stateFile = Join-Path $projectRoot "storage\app\public-backend-state.json"

if (-not (Test-Path $stateFile)) {
    Write-Host "State file не найден. Останавливать нечего."
    exit 0
}

$state = Get-Content $stateFile -Raw | ConvertFrom-Json

foreach ($propertyName in @("cloudflared_pid", "backend_pid")) {
    $processId = $state.$propertyName

    if ($processId) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "Stopped PID $processId"
        }
        catch {
            Write-Host "PID $processId уже не запущен."
        }
    }
}

Remove-Item $stateFile -Force -ErrorAction SilentlyContinue
Write-Host "Публичный backend остановлен."
