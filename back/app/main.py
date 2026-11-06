from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.db.session import init_db


def create_app() -> FastAPI:
    init_db()

    app = FastAPI(
        title=settings.app_name,
        debug=settings.app_debug,
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)

    front_dist = Path(__file__).resolve().parents[2] / "front" / "dist"
    if front_dist.is_dir():
        app.mount("/", StaticFiles(directory=str(front_dist), html=True), name="frontend")
    else:
        @app.get("/", tags=["meta"])
        def read_root() -> dict[str, str]:
            return {
                "app": settings.app_name,
                "environment": settings.app_env,
                "status": "ok",
            }

    return app


app = create_app()
