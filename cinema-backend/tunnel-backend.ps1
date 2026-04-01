param(
    [switch]$UseExistingServer,
    [string]$BindHost = "0.0.0.0",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$stateDirectory = Join-Path $projectRoot "storage\app"
$stateFile = Join-Path $stateDirectory "public-backend-state.json"

New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null

function Get-CloudflaredPath {
    $candidates = @(
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "C:\Program Files\cloudflared\cloudflared.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $command = Get-Command cloudflared -ErrorAction SilentlyContinue

    if ($command) {
        return $command.Source
    }

    throw "cloudflared не найден. Установите Cloudflare Tunnel или проверьте путь."
}

function Test-BackendReady([int]$TargetPort) {
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:$TargetPort" -TimeoutSec 2 | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

$backendProcess = $null

if (-not $UseExistingServer -and -not (Test-BackendReady -TargetPort $Port)) {
    $startScript = Join-Path $projectRoot "start-mobile-server.ps1"
    $backendProcess = Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", $startScript,
        "-Inline",
        "-BindHost", $BindHost,
        "-Port", $Port
    ) -PassThru

    $ready = $false
    foreach ($attempt in 1..20) {
        Start-Sleep -Seconds 1

        if (Test-BackendReady -TargetPort $Port) {
            $ready = $true
            break
        }
    }

    if (-not $ready) {
        throw "Backend не поднялся на http://127.0.0.1:$Port."
    }
}

$cloudflaredPath = Get-CloudflaredPath
$stdoutPath = Join-Path $env:TEMP "cinema-cloudflared.out.log"
$stderrPath = Join-Path $env:TEMP "cinema-cloudflared.err.log"

Remove-Item $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

$cloudflaredProcess = Start-Process -FilePath $cloudflaredPath -ArgumentList @(
    "tunnel",
    "--url", "http://127.0.0.1:$Port",
    "--no-autoupdate"
) -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

$publicUrl = $null

foreach ($attempt in 1..45) {
    Start-Sleep -Seconds 1
    $output = @(
        (Get-Content $stdoutPath -Raw -ErrorAction SilentlyContinue),
        (Get-Content $stderrPath -Raw -ErrorAction SilentlyContinue)
    ) -join "`n"

    if ($output -match 'https://[-a-z0-9]+\.trycloudflare\.com') {
        $publicUrl = $matches[0]
        break
    }
}

if (-not $publicUrl) {
    throw "Cloudflare tunnel не выдал публичный URL. Проверьте логи: $stdoutPath и $stderrPath"
}

$state = [ordered]@{
    api_url = "$publicUrl/api"
    backend_pid = $backendProcess?.Id
    backend_started = [bool]$backendProcess
    bind_host = $BindHost
    cloudflared_pid = $cloudflaredProcess.Id
    port = $Port
    public_url = $publicUrl
    started_at = (Get-Date).ToString("o")
    stderr_log = $stderrPath
    stdout_log = $stdoutPath
}

$state | ConvertTo-Json | Set-Content -Path $stateFile -Encoding utf8

Write-Host ""
Write-Host "Public URL: $publicUrl"
Write-Host "API URL: $publicUrl/api"
Write-Host "State file: $stateFile"
Write-Host ""
Write-Host "Оставьте backend и cloudflared запущенными, пока вы и друг пользуетесь приложением."
