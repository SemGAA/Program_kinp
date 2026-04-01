FROM php:8.3-apache

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libpq-dev libsqlite3-dev libzip-dev \
    && docker-php-ext-install pdo_pgsql pdo_sqlite zip \
    && a2enmod rewrite headers \
    && sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
        /etc/apache2/sites-available/*.conf \
        /etc/apache2/apache2.conf \
        /etc/apache2/conf-available/*.conf \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader --no-scripts

COPY . .
COPY docker/apache/start.sh /usr/local/bin/render-start

RUN chmod +x /usr/local/bin/render-start \
    && php artisan package:discover --ansi \
    && mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/testing storage/framework/views bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 10000

CMD ["render-start"]
