# Deploy to Render

## 1. Import the repository

1. Open Render dashboard.
2. Choose `New` -> `Blueprint`.
3. Select the repository that contains this project.
4. Confirm the root `render.yaml`.

Render will create:

- web service `cinema-backend-api`
- postgres database `cinema-backend-db`

## 2. Set required environment variables

In the Render web service, fill these values:

- `APP_KEY`
- `APP_URL`
- `TMDB_API_KEY`
- optional `HF_TOKEN`
- optional `CORS_ALLOWED_ORIGINS`

Generate `APP_KEY` locally:

```powershell
cd D:\Main\Programing\Program_kinp\cinema-backend
php artisan key:generate --show
```

Set `APP_URL` to the final Render service URL, for example:

```text
https://cinema-backend-api.onrender.com
```

## 3. Wait for the first deploy

Render will:

- build the Docker image
- start Apache + PHP
- run `php artisan migrate --force`

## 4. Verify the backend

Open:

```text
https://your-render-service.onrender.com/up
```

Then test login:

```powershell
Invoke-RestMethod -Method Post `
  -Uri 'https://your-render-service.onrender.com/api/login' `
  -ContentType 'application/json' `
  -Body (@{ email = 'alice@example.com'; password = 'password123' } | ConvertTo-Json)
```

If the response contains `access_token`, the backend is ready.

## 5. Build the APK with the public URL

```powershell
cd D:\Main\Programing\Program_kinp\cinema-app
$env:EXPO_PUBLIC_API_BASE_URL='https://your-render-service.onrender.com/api'
npm run build:apk
```

## 6. Important notes

- Do not use the placeholder `https://your-render-service.onrender.com/api` in a real build.
- The public APK should always be built against the real Render URL.
- `TMDB_API_KEY` is required for movie search and movie details.
