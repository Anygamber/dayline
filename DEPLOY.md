# Dayline — деплой в Firebase + Cloud Run

Гибрид: **Firebase Hosting** (веб-прототип) + **Google Cloud Run** (FastAPI).  
Cloud Run выбран вместо Cloud Functions: так надёжнее для ASGI/FastAPI, `namozvaqti` HTTP и долгоживущего uvicorn.

Expo-приложение (мобильное) деплоится отдельно через **EAS** — Hosting обслуживает веб-прототип из `static/`.

---

## 0. Один раз: подготовка Google Cloud / Firebase

1. Создайте проект в [Firebase Console](https://console.firebase.google.com/) (или GCP) — например `dayline-app`.
2. Обновите `.firebaserc` → `"default": "ваш-project-id"`.
3. Установите CLI:

```bash
npm i -g firebase-tools
# gcloud: https://cloud.google.com/sdk/docs/install
```

4. Войдите и привяжите проект:

```bash
firebase login
firebase use dayline-app

gcloud auth login
gcloud config set project dayline-app
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firebasehosting.googleapis.com
```

5. Репозиторий образов (один раз):

```bash
gcloud artifacts repositories create dayline \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Dayline API images"
```

6. Права Cloud Build → Artifact Registry / Cloud Run (если `builds submit` ругается на permission — в GCP IAM выдайте аккаунту Cloud Build роли Artifact Registry Writer и Cloud Run Admin).

---

## 1. Быстрый деплой (одна команда)

**Windows (PowerShell):**

```powershell
.\scripts\deploy.ps1 -ProjectId dayline-app
```

**macOS / Linux:**

```bash
chmod +x scripts/*.sh
PROJECT_ID=dayline-app ./scripts/deploy.sh
```

Скрипт:

1. Собирает Docker-образ FastAPI и выкладывает в **Cloud Run** (`dayline-api`).
2. Копирует `static/` → `hosting/public/` (пути `/static/...` сохраняются).
3. Делает `firebase deploy --only hosting` (rewrites `/api/**` → Cloud Run).

Только фронт:

```powershell
.\scripts\deploy.ps1 -HostingOnly
```

Только API:

```powershell
.\scripts\deploy.ps1 -ApiOnly
```

---

## 2. Ручной деплой (эквивалент)

```bash
# API
gcloud builds submit --tag europe-west1-docker.pkg.dev/dayline-app/dayline/api:latest
gcloud run deploy dayline-api \
  --image europe-west1-docker.pkg.dev/dayline-app/dayline/api:latest \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "ENVIRONMENT=production,APP_HOST=0.0.0.0,DATABASE_URL=sqlite:////tmp/dayline.db,CORS_ORIGINS=https://dayline-app.web.app,https://dayline-app.firebaseapp.com"

# Hosting
./scripts/prepare-hosting.sh   # или prepare-hosting.ps1
firebase deploy --only hosting
```

Короткая команда после первой настройки API:

```bash
firebase deploy
```

(сейчас в `firebase.json` только Hosting; API — через `scripts/deploy` / `gcloud run`.)

---

## 3. Переменные окружения (продакшн)

| Переменная | Назначение |
|---|---|
| `PORT` | Порт Cloud Run (подставляется платформой, обычно `8080`) |
| `APP_HOST` | `0.0.0.0` |
| `DATABASE_URL` | `sqlite:////tmp/dayline.db` (эфемерно) или Cloud SQL |
| `CORS_ORIGINS` | `https://<project>.web.app,https://<project>.firebaseapp.com,…` |
| `JWT_SECRET` | Обязательно сменить с дефолта |
| `NAMOZVAQTI_BASE_URL` | `https://namozvaqti.uz` |
| `DEFAULT_REGION` | `toshkent` |

Секреты лучше через Secret Manager + `--set-secrets`, а не plaintext env.

---

## 4. Как склеиваются URL

| URL | Куда |
|---|---|
| `https://<project>.web.app/` | Hosting → `index.html` |
| `https://<project>.web.app/static/js/…` | Hosting static files |
| `https://<project>.web.app/api/…` | Hosting rewrite → Cloud Run |
| `https://<project>.web.app/health` | Cloud Run |
| `https://<project>.web.app/docs` | Cloud Run Swagger |

Веб-клиент (`dayline.js`) на проде использует **относительный** `API_BASE=""` (same-origin), локально — `http://127.0.0.1:8001`.

---

## 5. База данных

SQLite в `/tmp` на Cloud Run **не переживает** рестарт инстанса — ок для демо.  
Для продакшна: Cloud SQL (Postgres) и `DATABASE_URL=postgresql+psycopg://…`.

---

## 6. Expo (мобильное приложение)

```bash
cd mobile
npx eas-cli login
npx eas build --platform android   # или ios
```

Укажите прод-URL API в конфиге мобильного клиента (например `https://<project>.web.app`), когда будете переводить Expo с локального бэкенда.

Опционально веб-сборка Expo:

```bash
cd mobile && npx expo export -p web
# затем скопируйте dist/ в hosting/public/app/ и добавьте rewrite при необходимости
```

---

## 7. Почему не Cloud Functions (Python)

Можно обернуть FastAPI через Functions Framework, но:

- холодный старт и лимиты хуже для парсинга namozvaqti;
- ASGI/uvicorn удобнее на Cloud Run;
- Firebase Hosting умеет rewrite сразу на Cloud Run.

Если понадобятся лёгкие триггеры (cron очистки) — отдельные 2nd gen Functions рядом с основным API на Cloud Run.

---

## 8. Проверка после деплоя

```bash
curl -s https://dayline-app.web.app/health
curl -s "https://dayline-app.web.app/api/day-timeline?region=toshkent" | head
```

Откройте `https://dayline-app.web.app`, переключите источник на **Live API**.
