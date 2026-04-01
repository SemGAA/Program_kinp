# Cinema Notes: что нажимать по шагам

Ниже только те действия, которые реально нужны от вас. Всё остальное в проекте уже подготовлено.

## Часть 1. Поднять публичный backend в Render

### Шаг 1. Открыть Render

1. Откройте браузер.
2. Перейдите на [https://dashboard.render.com/](https://dashboard.render.com/).
3. Войдите в аккаунт.

### Шаг 2. Создать Blueprint deploy

1. В верхнем меню нажмите `New +`.
2. Выберите `Blueprint`.
3. Если Render попросит подключить GitHub:
   - нажмите `Connect GitHub`
   - разрешите доступ
   - выберите репозиторий с проектом `Program_kinp`
4. После выбора репозитория Render сам найдёт файл:
   - `render.yaml`
5. Нажмите `Apply`.

После этого Render создаст:
- web service `cinema-backend-api`
- postgres database `cinema-backend-db`

### Шаг 3. Сгенерировать APP_KEY локально

Откройте PowerShell и выполните:

```powershell
cd D:\Main\Programing\Program_kinp\cinema-backend
powershell -ExecutionPolicy Bypass -File .\prepare-render-env.ps1
```

Скопируйте строку `base64:...` целиком.

### Шаг 4. Заполнить переменные в Render

1. В Render откройте сервис `cinema-backend-api`.
2. Перейдите во вкладку `Environment`.
3. Нажмите `Add Environment Variable`.
4. Добавьте по одной:

`APP_KEY`
- value: строка `base64:...` из предыдущего шага

`APP_URL`
- value: адрес вашего сервиса
- пример: `https://cinema-backend-api.onrender.com`

`TMDB_API_KEY`
- value: ваш ключ TMDB

`HF_TOKEN`
- value: необязательно, можно оставить пустым и не добавлять сейчас

`CORS_ALLOWED_ORIGINS`
- value: `https://expo.dev,https://*.expo.dev`

Если Render уже сам подставил DB-переменные из `render.yaml`, руками добавлять `DB_HOST/DB_PORT/...` не нужно.

### Шаг 5. Запустить deploy

1. После добавления env нажмите `Manual Deploy`.
2. Выберите `Deploy latest commit`.
3. Дождитесь статуса `Live`.

### Шаг 6. Проверить backend

Когда сервис станет `Live`, откройте:

```text
https://ВАШ-URL-ИЗ-RENDER/up
```

Пример:

```text
https://cinema-backend-api.onrender.com/up
```

Если открывается страница/ответ без ошибки, backend жив.

## Часть 2. Собрать APK

### Шаг 7. Открыть PowerShell

Выполните:

```powershell
cd D:\Main\Programing\Program_kinp\cinema-app
```

### Шаг 8. Собрать APK с реальным URL

Подставьте ваш Render URL:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-production-apk.ps1 -ApiBaseUrl "https://ВАШ-URL-ИЗ-RENDER/api"
```

Пример:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-production-apk.ps1 -ApiBaseUrl "https://cinema-backend-api.onrender.com/api"
```

### Шаг 9. Дождаться ссылки на сборку

Когда EAS закончит сборку, он покажет ссылку вида:

```text
https://expo.dev/accounts/.../projects/.../builds/...
```

Откройте её и скачайте APK.

## Часть 3. Проверить приложение

### Шаг 10. Установить APK на телефон

1. Откройте ссылку со сборкой на телефоне.
2. Скачайте APK.
3. Установите приложение.

### Шаг 11. Проверить регистрацию и вход

В приложении:
1. Нажмите `Регистрация`
2. Введите:
   - имя
   - email
   - пароль
3. Нажмите `Создать аккаунт`

Потом:
1. Выйдите при необходимости
2. Нажмите `Вход`
3. Введите тот же email и пароль
4. Нажмите `Войти`

## Что прислать мне после ваших шагов

Пришлите один из этих вариантов:

1. `вот мой Render URL: https://...`
2. `Render deploy упал, вот ошибка: ...`
3. `APK build started, вот ссылка: ...`

Если пришлёте Render URL, я сразу проверю, всё ли собрано правильно, и дам вам финальную команду без догадок.
