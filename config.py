from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Dayline"
    database_url: str = "sqlite:///./prayer_habits.db"
    default_region: str = "toshkent"
    timezone: str = "Asia/Tashkent"
    namozvaqti_base_url: str = "https://namozvaqti.uz"
    http_timeout_seconds: float = 15.0
    # Reserved elsewhere — do not use:
    #   8000 — Optimusbot Lead Webhook (optimusca.uz)
    #   8010 — website local work
    #   8080 — other local service / Cloud Run default PORT
    # 0.0.0.0 so Expo on a physical device can reach the API over LAN
    app_host: str = "0.0.0.0"
    app_port: int = 8001

    jwt_secret: str = "dev-clinic-crm-jwt-secret-key-32b!"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12
    cors_origins: str = (
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:19006,http://127.0.0.1:19006,"
        "http://localhost:8001,http://127.0.0.1:8001,"
        "https://dayline-app.web.app,https://dayline-app.firebaseapp.com"
    )
    # production | development — affects DB path hints in docs; CORS still from cors_origins
    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
