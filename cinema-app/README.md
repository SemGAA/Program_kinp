# Cinema Notes Mobile

Мобильный клиент Expo / React Native для Cinema Notes.

## Основной production-сценарий

Приложение должно собираться с публичным backend URL:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com/api
```

Шаблон лежит в:

- `.env.production.example`

## Локальная разработка

Если backend поднят на ПК, Expo может работать в локальной сети.

```powershell
cd D:\Main\Programing\Program_kinp\cinema-app
npm install
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.0.102:8000/api"
npm run start:lan
```

## APK сборка

Перед сборкой задайте публичный backend URL:

```powershell
cd D:\Main\Programing\Program_kinp\cinema-app
$env:EXPO_PUBLIC_API_BASE_URL="https://your-render-service.onrender.com/api"
npm run build:apk
```

Если вы ещё не вошли в Expo / EAS:

```powershell
npx eas-cli login
```