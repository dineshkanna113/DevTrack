from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        # Malformed hash or password over bcrypt's 72-byte limit
        return False


def create_access_token(user_id: int, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload: dict[str, Any] = {"sub": str(user_id), "iat": now, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int:
    """Return the user id encoded in a valid access token. Raises `jwt.PyJWTError` otherwise."""
    settings = get_settings()
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "exp"]},
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    try:
        return int(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise jwt.InvalidTokenError("Invalid subject") from exc
