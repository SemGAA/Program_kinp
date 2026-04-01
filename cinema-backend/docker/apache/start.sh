#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-10000}"

sed -ri "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/:80>/:${PORT}>/" /etc/apache2/sites-available/000-default.conf

if ! grep -q "^ServerName" /etc/apache2/apache2.conf; then
  echo "ServerName 0.0.0.0" >> /etc/apache2/apache2.conf
fi

php artisan config:clear >/dev/null 2>&1 || true
php artisan route:clear >/dev/null 2>&1 || true
php artisan view:clear >/dev/null 2>&1 || true

exec apache2-foreground
