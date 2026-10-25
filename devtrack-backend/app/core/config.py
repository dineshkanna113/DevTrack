from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULT_SECRET = "dev-only-insecure-secret-change-me"  # noqa: S105


class Settings(BaseSettings):
    """Application settings, loaded from environment variables (and `.env` in local dev)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "DevTrack API"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://devtrack:devtrack@localhost:5432/devtrack"

    secret_key: str = _INSECURE_DEFAULT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Comma-separated list, e.g. "http://localhost:5173,https://devtrack.vercel.app"
    cors_origins: str = "http://localhost:5173"

    anthropic_api_key: str | None = None
    ai_model: str = "claude-opus-5-5"

    @field_validator("database_url")
    @classmethod
    def _normalize_postgres_driver(cls, url: str) -> str:
        # Render/Heroku hand out `postgres://` URLs; SQLAlchemy needs an explicit driver.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> "Settings":
        if self.is_production and self.secret_key == _INSECURE_DEFAULT_SECRET:
            raise ValueError("SECRET_KEY must be set in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def ai_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
