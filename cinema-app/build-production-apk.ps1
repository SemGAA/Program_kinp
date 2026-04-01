param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl
)

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not $ApiBaseUrl.StartsWith("https://")) {
    throw "ApiBaseUrl должен начинаться с https://"
}

$env:EXPO_PUBLIC_API_BASE_URL = $ApiBaseUrl.TrimEnd("/")

Write-Host "Using API base URL: $env:EXPO_PUBLIC_API_BASE_URL"
Write-Host "Starting EAS APK build..."

npx eas-cli build -p android --profile preview
