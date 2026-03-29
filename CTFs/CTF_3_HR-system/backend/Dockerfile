FROM php:8.4-cli

# Install system dependencies and PostgreSQL extension
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpq-dev \
    unzip \
    && docker-php-ext-install pdo pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install PHP dependencies first (layer-cached separately from source)
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

COPY . .

RUN mkdir -p bootstrap/cache storage/logs storage/framework/cache storage/framework/sessions storage/framework/views \
    && chmod -R 775 bootstrap/cache storage \
    && COMPOSER_ALLOW_SUPERUSER=1 php artisan package:discover --ansi

# Generate a base APP_KEY; real env vars are injected at runtime by Compose
RUN cp .env.example .env && php artisan key:generate --force

RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8004

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8004"]
