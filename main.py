from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from config import get_settings
from crm.routers_auth import router as auth_router
from crm.routers_clinic import router as clinic_router
from crm.seed import seed_crm_users
from database import SessionLocal, init_db
from routers.schedule import router as schedule_router

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


class NoCacheStaticFiles(StaticFiles):
    """Serve static assets without browser caching (dev-friendly live reload via F5)."""

    def file_response(self, *args, **kwargs) -> Response:
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        return response


def seed_default_habits() -> None:
    """Habits are user-created; do not install demo catalog on startup."""
    return


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    seed_default_habits()
    with SessionLocal() as db:
        seed_crm_users(db)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    # Dev or explicit "*": allow any origin (Expo web / LAN / first cloud smoke-test).
    if settings.environment == "development" or origins == ["*"] or "*" in origins:
        origins = ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=origins != ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(schedule_router)
    app.include_router(auth_router)
    app.include_router(clinic_router)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/", include_in_schema=False)
    def dashboard():
        return FileResponse(
            STATIC_DIR / "index.html",
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
            },
        )

    app.mount(
        "/static",
        NoCacheStaticFiles(directory=STATIC_DIR),
        name="static",
    )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=True,
        reload_dirs=[str(BASE_DIR)],
    )
