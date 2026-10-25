import logging

from fastapi import APIRouter, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import __version__
from app.api.deps import DbSession
from app.api.routes import ai, auth, issues, projects
from app.core.config import get_settings
from app.core.logging import configure_logging, request_context_middleware
from app.schemas import HealthOut

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description="Issue tracking API with projects, Kanban workflow, and AI-assisted triage.",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.middleware("http")(request_context_middleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(_: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning("Integrity error: %s", exc.orig)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "Request conflicts with existing data"},
        )

    api = APIRouter(prefix=settings.api_prefix)
    for module in (auth, projects, issues, ai):
        api.include_router(module.router)
    app.include_router(api)

    @app.get("/health", response_model=HealthOut, tags=["meta"])
    def health(db: DbSession) -> HealthOut:
        try:
            db.execute(text("SELECT 1"))
            database = "ok"
        except SQLAlchemyError:
            database = "unavailable"
        return HealthOut(
            status="ok" if database == "ok" else "degraded",
            database=database,
            ai_enabled=settings.ai_enabled,
            version=__version__,
        )

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {"name": settings.app_name, "docs": "/docs", "health": "/health"}

    return app


app = create_app()
