# Гайд по запуску Cinema Notes

Ниже два разных сценария:

1. локальная разработка на вашем ПК
2. production-путь для APK с публичным backend

## 1. Локальная разработка

### Backend

```powershell
cd D:\Main\Programing\Program_kinp\cinema-backend
php artisan migrate:fresh --seed
powershell -ExecutionPolicy Bypass -File .\start-mobile-server.ps1 -Inline
```

Проверка:

- откройте `http://127.0.0.1:8000`
- на телефоне в той же сети откройте `http://192.168.0.102:8000`

### Expo Go на телефоне

```powershell
cd D:\Main\Programing\Program_kinp\cinema-app
npm install
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.0.102:8000/api"
npm run start:lan
```

### Тестовый вход

- `alice@example.com` / `password123`
- `bob@example.com` / `password123`

## 2. Публичный backend для APK

### Быстрый режим для совместного просмотра

Если нужно просто открыть приложение на двух Android-телефонах и смотреть вместе без ручного ввода адреса:

```powershell
cd D:\Main\Programing\Program_kinp\cinema-backend
php artisan migrate:fresh --seed
.\watch-party-online.cmd
```

Скрипт:
- поднимет backend в отдельном окне;
- поднимет публичный Serveo tunnel;
- автоматически обновит `mobile-bootstrap.json` в GitHub.

После этого на телефонах:
1. полностью закройте приложение;
2. откройте его заново;
3. войдите под своими аккаунтами.

Ручной ввод `API URL` не нужен, если bootstrap уже обновился.

### Постоянный публичный backend

В репозитории уже подготовлены:

- `render.yaml`
- `cinema-backend/Dockerfile`
- `cinema-backend/.env.render.example`

Шаги:

1. импортировать репозиторий в Render
2. задеплоить `render.yaml`
3. заполнить env:
   - `APP_KEY`
   - `APP_URL`
   - `TMDB_API_KEY`
   - optional `HF_TOKEN`
4. дождаться URL вида `https://your-render-service.onrender.com`

### APK

После появления Render URL:

```powershell
cd D:\Main\Programing\Program_kinp\cinema-app
$env:EXPO_PUBLIC_API_BASE_URL="https://your-render-service.onrender.com/api"
npm run build:apk
```

## 3. Что больше не использовать

Не используйте старые команды:

```powershell
php artisan serve --host=0.0.0.0 --port=8000 --no-reload
```

и старые APK, собранные под локальный IP.

## 4. Проверка после деплоя

Backend:

```powershell
Invoke-RestMethod -Method Post -Uri 'https://your-render-service.onrender.com/api/login' -ContentType 'application/json' -Body (@{ email = 'alice@example.com'; password = 'password123' } | ConvertTo-Json)
```

Если в ответе есть `access_token`, backend готов.
