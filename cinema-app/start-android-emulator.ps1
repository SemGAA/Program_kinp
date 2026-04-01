$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

$androidHome = $env:ANDROID_HOME
$androidSdkRoot = $env:ANDROID_SDK_ROOT
$adbCommand = Get-Command adb -ErrorAction SilentlyContinue

if (-not $adbCommand -and -not $androidHome -and -not $androidSdkRoot) {
    Write-Host 'Android SDK / adb not found.' -ForegroundColor Yellow
    Write-Host 'To use npm run android or this script, install Android Studio with:' -ForegroundColor Yellow
    Write-Host '- Android SDK' -ForegroundColor Yellow
    Write-Host '- Android SDK Platform-Tools' -ForegroundColor Yellow
    Write-Host '- an Android emulator device' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'For now you can use one of these alternatives:' -ForegroundColor Cyan
    Write-Host '1. Install the built APK on your phone' -ForegroundColor Cyan
    Write-Host '2. Run .\start-phone.ps1 and open the app in Expo Go on a real device' -ForegroundColor Cyan
    exit 1
}

Write-Host 'Starting Expo for Android emulator...' -ForegroundColor Cyan
npx expo start --android
