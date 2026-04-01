param(
    [switch]$Inline,
    [string]$BindHost = "0.0.0.0",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$publicRoot = Join-Path $projectRoot "public"
$routerPath = Join-Path $env:TEMP "cinema-backend-router.php"
$projectRootForPhp = $projectRoot -replace "\\", "/"

$routerContent = @"
<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

\$projectRoot = '$projectRootForPhp';
\$documentRoot = \$projectRoot . '/public';
\$uri = urldecode(parse_url(\$_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');

if (\$uri !== '/' && file_exists(\$documentRoot.\$uri)) {
    return false;
}

define('LARAVEL_START', microtime(true));

if (file_exists(\$maintenance = \$projectRoot.'/storage/framework/maintenance.php')) {
    require \$maintenance;
}

require \$projectRoot.'/vendor/autoload.php';

/** @var Application \$app */
\$app = require_once \$projectRoot.'/bootstrap/app.php';

\$app->handleRequest(Request::capture());
"@

Set-Content -Path $routerPath -Value $routerContent -Encoding utf8 -Force

if (-not $Inline) {
    $command = "& '$PSCommandPath' -Inline -BindHost '$BindHost' -Port $Port"
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command | Out-Null
    Write-Host "Server window opened."
    Write-Host "URL: http://$BindHost`:$Port"
    Write-Host "Router: $routerPath"
    exit 0
}

Write-Host "Starting Cinema backend on http://$BindHost`:$Port"
Write-Host "Project: $projectRoot"
Write-Host "Router: $routerPath"

& php -S "$BindHost`:$Port" -t $publicRoot $routerPath
