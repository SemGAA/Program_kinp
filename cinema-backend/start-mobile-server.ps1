param(
    [switch]$Inline
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$command = "Set-Location '$projectRoot'; php -S 0.0.0.0:8000 -t public public/index.php"

if ($Inline) {
    Write-Host "Starting Cinema backend on http://0.0.0.0:8000"
    Set-Location $projectRoot
    & php -S 0.0.0.0:8000 -t public public/index.php
    exit $LASTEXITCODE
}

Write-Host "Starting Cinema backend in a new window..."
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $command -WorkingDirectory $projectRoot | Out-Null

Write-Host "Waiting for backend on http://127.0.0.1:8000 ..."
$ready = $false

for ($attempt = 0; $attempt -lt 25; $attempt++) {
    try {
        & curl.exe -I --max-time 2 http://127.0.0.1:8000 > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
    } catch {
    }

    Start-Sleep -Seconds 1
}

if (-not $ready) {
    throw 'Backend did not start in time.'
}

Write-Host "Backend is ready."
