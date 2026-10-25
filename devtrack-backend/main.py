"""Compatibility entrypoint so `uvicorn main:app` keeps working. Prefer `uvicorn app.main:app`."""

from app.main import app

__all__ = ["app"]
