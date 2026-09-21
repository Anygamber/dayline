# Prayer Habits Schedule

Локальное FastAPI-приложение (namozvaqti.uz + привычки) с дашбордом.

## Порты

| Сервис | Порт | Примечание |
|--------|------|------------|
| **Это приложение** | **8001** | http://127.0.0.1:8001 |
| Optimusbot Lead Webhook | **8000** | не трогать |
| Работа сайта | **8010** | не трогать |
| Другой локальный сервис | **8080** | не трогать |

## Запуск

```powershell
cd c:\Users\user\Projects\Custom
.\.venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8001 --reload-dir .
```

Или `start.bat` / `start_hidden.vbs`, либо `python main.py`.

`--reload` перезапускает бэкенд при изменении `.py`. Статика (`static/`) отдаётся с `Cache-Control: no-store` — достаточно обновить страницу в браузере (F5).

## Интерфейс

- **Дашборд:** http://127.0.0.1:8001/
- Swagger: http://127.0.0.1:8001/docs
- Health: http://127.0.0.1:8001/health
- Намазы: http://127.0.0.1:8001/api/prayer-times?region=toshkent
- Таймлайн: http://127.0.0.1:8001/api/day-timeline?region=toshkent

## Деплой (Firebase Hosting + Cloud Run)

См. подробную инструкцию: [DEPLOY.md](./DEPLOY.md)

```powershell
.\scripts\deploy.ps1 -ProjectId dayline-app
```
