# Dayline FastAPI — Render / Railway / Cloud Run
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_HOST=0.0.0.0 \
    PORT=8001 \
    ENVIRONMENT=production \
    DATABASE_URL=sqlite:////tmp/dayline.db

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config.py database.py main.py ./
COPY crm ./crm
COPY models ./models
COPY routers ./routers
COPY schemas ./schemas
COPY services ./services
COPY static ./static

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8001}/health" || exit 1

# Render / Railway / Cloud Run inject $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
