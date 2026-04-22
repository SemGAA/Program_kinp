# Cinema Notes

![Expo](https://img.shields.io/badge/Expo-111827?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-111827?style=for-the-badge&logo=react&logoColor=61dafb)
![Laravel](https://img.shields.io/badge/Laravel-111827?style=for-the-badge&logo=laravel&logoColor=ff4b36)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-111827?style=for-the-badge&logo=cloudflare&logoColor=f38020)
![Android](https://img.shields.io/badge/Android-111827?style=for-the-badge&logo=android&logoColor=3ddc84)

Мобильное Android-приложение для совместного просмотра, комнат, профилей друзей и заметок по фильмам, сериалам и аниме.

[Скачать APK](https://raw.githubusercontent.com/SemGAA/Program_kinp/apk-downloads/downloads/cinema-notes-android.apk) · [Релизы](https://github.com/SemGAA/Program_kinp/releases) · [Страница проекта](https://semgaa.github.io/Program_kinp/) · [Портфолио](https://semgaa.github.io/)

## Идея

Cinema Notes закрывает понятный пользовательский сценарий: выбрать фильм, сериал или аниме, создать комнату, пригласить друга и вести обсуждение просмотра в одном месте. Приложение не заставляет держать заметки, профиль, друзей и ссылку на комнату в разных местах.

## Что внутри

- Живой поиск по фильмам, сериалам, аниме, открытым видео и личной Jellyfin-медиатеке.
- Комнаты просмотра с кодом, участниками, приглашениями друзьям и шарингом.
- Встроенный плеер для прямых потоков, Internet Archive и Jellyfin.
- Обсуждения во время просмотра, чтобы пользователь не терял контекст комнаты и тайтла.
- Заметки по тайтлам: впечатления, рекомендации и сохраненные мысли.
- Профили: аватарка, никнейм, описание, друзья и публичная страница.
- Android UI с safe-area навигацией, русской локализацией и адаптацией под клавиатуру.
- Backend API для аккаунтов, друзей, комнат, заметок, приглашений и рекомендаций.

## Мой вклад

- Собрал mobile-first интерфейс на Expo Router: навигация, профиль, комнаты просмотра, состояния авторизации и адаптация под Android.
- Разделил продукт на клиент, Laravel API, Cloudflare Worker-эксперименты, документацию и release notes.
- Оформил безопасную политику источников: приложение не подключает пиратские балансеры и работает с легальными или личными потоками.
- Подготовил проект для портфолио: README, GitHub Pages, APK-релизы, changelog и проверки качества.

## Архитектура

```text
cinema-app/          Expo + React Native Android client
cinema-backend/      Laravel API, auth, rooms, friends, notes, catalog
cloudflare-worker/   Lightweight API variant for edge/runtime experiments
docs/                GitHub Pages product page
release-notes/       Release texts for GitHub Releases
```

## Технические детали

- Mobile: Expo `~54.0.33`, React Native `0.81.5`, React `19.1.0`, TypeScript `~5.9.2`.
- Backend: PHP `^8.2`, Laravel `^12.0`, Sanctum `^4.3`, Reverb `^1.0`, PHPUnit `^11.5`.
- Data layer: Laravel migrations/models for accounts, rooms, friends, notes, invitations and catalog data.
- Runtime: Cloudflare Worker используется как легкий edge/API-эксперимент рядом с основным Laravel backend.
- Релизный контур: stable/beta tags, APK artifacts, changelog и GitHub Releases.

## Источники видео и безопасность

Cinema Notes не подключает пиратские балансеры. Каталог может находить карточки через TMDB и Shikimori, но встроенный плеер запускает только подключенные легальные или личные источники:

- Internet Archive для открытых видео.
- Прямые видеофайлы `mp4`, `m3u8`, `webm`.
- Jellyfin для личной библиотеки пользователя.

Если у найденной карточки нет потока, приложение открывает карточку и заметки, а не пустой сломанный плеер.

Подробная политика источников: [docs/source-policy.md](./docs/source-policy.md).

## Почему проект полезен для портфолио

- Показывает mobile-first мышление: навигация, состояние авторизации, профиль, комнаты и плеер.
- Есть backend-логика, а не только экранные макеты.
- Есть работа с API, внешними каталогами, fallback-сценариями и ошибками сети.
- Есть релизный контур: changelog, beta/stable tags, GitHub Releases и APK.
- Код разделен на клиент, backend, worker и документацию.
- Видно личный вклад: от UI и архитектуры до приватности, документации и публикации.

## Проверки

- `cinema-app`: `npm run lint`, `npx tsc --noEmit`.
- `cinema-backend`: `php artisan test`.
- Проверка приватности: `.env`, build artifacts, временные файлы и личные данные не публикуются.

## Быстрый старт

Мобильное приложение:

```bash
cd cinema-app
npm install
npm run lint
npx tsc --noEmit
```

Laravel backend:

```bash
cd cinema-backend
composer install
php artisan test
php artisan serve
```

Сборка локального Android APK:

```bash
cd cinema-app/android
./gradlew assembleRelease --console=plain
```

## Релизы

- Stable: теги вида `v1.6.0`.
- Beta: теги вида `v1.6.0-beta.1`.
- APK прикладывается к GitHub Release автоматически через workflow.
- Важные изменения фиксируются в [CHANGELOG.md](./CHANGELOG.md).

## Статус

Проект используется как флагман портфолио SemGAA: Android + fullstack + аккуратная публикация релизов.

## Авторские права

Copyright © 2026 SemGAA. Cinema Notes. All rights reserved.

Исходный код, дизайн, название, иконки, изображения и сборки APK являются авторской работой владельца проекта, если явно не указано иное. Сторонние библиотеки сохраняют собственные лицензии.
