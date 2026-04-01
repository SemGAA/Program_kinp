# Cinema Backend

Laravel API для мобильного приложения Cinema Notes.

## Что уже работает

- регистрация и логин через Sanctum bearer tokens
- поиск фильмов через TMDB proxy
- заметки по фильмам и шаринг заметок друзьям
- friend requests и список друзей
- рекомендации по фильмам с fallback на TMDB и optional Hugging Face rerank

## Локальный запуск на Windows

Используйте только этот сценарий:

```powershell
cd D:\Main\Programing\Program_kinp\cinema-backend
php artisan migrate:fresh --seed
powershell -ExecutionPolicy Bypass -File .\start-mobile-server.ps1 -Inline
```

Альтернатива:

```powershell
cd D:\Main\Programing\Program_kinp\cinema-backend
.\start-mobile-server-inline.cmd
```

После запуска backend должен отвечать на:

- `http://127.0.0.1:8000`
- `http://192.168.0.102:8000` в вашей текущей локальной сети

Тестовые аккаунты после `migrate:fresh --seed`:

- `alice@example.com` / `password123`
- `bob@example.com` / `password123`

## Production / Render

В репозитории уже подготовлены:

- `Dockerfile`
- `.dockerignore`
- `render.yaml`
- `.env.render.example`

Что нужно сделать для выкладки:

1. Импортировать репозиторий в Render как Blueprint.
2. Создать Render Postgres.
3. Заполнить env:
   - `APP_KEY`
   - `APP_URL`
   - `TMDB_API_KEY`
   - optional `HF_TOKEN`
4. Дождаться первого deploy.
5. Проверить `https://<render-service>/up` и `POST /api/login`.

## Переменные окружения

Для локальной разработки используйте `.env` / `.env.example`.

Для production используйте `.env.render.example` как шаблон.