param(
    [string]$ApiBaseUrl
)

$ErrorActionPreference = 'Stop'

function Get-LanIpAddress {
    $ipconfigOutput = ipconfig
    $ipv4Lines = $ipconfigOutput | Where-Object { $_ -match 'IPv4' }

    foreach ($line in $ipv4Lines) {
        if ($line -match '(\d{1,3}\.){3}\d{1,3}') {
            $candidate = $Matches[0]

            if ($candidate -notmatch '^127\.' -and
                $candidate -notmatch '^169\.254\.' -and
                $candidate -notmatch '^172\.16\.0\.2$') {
                return $candidate
            }
        }
    }

    return $null
}

Set-Location $PSScriptRoot

if (-not $ApiBaseUrl) {
    $lanIp = Get-LanIpAddress

    if (-not $lanIp) {
        throw 'Could not detect LAN IP automatically. Run: .\start-phone.ps1 -ApiBaseUrl http://YOUR_IP:8000/api'
    }

    $ApiBaseUrl = "http://$lanIp`:8000/api"
}

$env:EXPO_PUBLIC_API_BASE_URL = $ApiBaseUrl

Write-Host "Using API base URL: $ApiBaseUrl" -ForegroundColor Cyan
Write-Host 'Starting Expo in LAN mode for a physical phone...' -ForegroundColor Cyan
Write-Host 'Expo cache will be cleared so the phone receives the fresh bundle.' -ForegroundColor DarkGray

npx expo start --lan --clear
