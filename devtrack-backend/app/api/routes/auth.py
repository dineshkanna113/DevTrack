from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.rate_limit import login_limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# Checked when the email doesn't exist, so "unknown email" takes as long as "wrong
# password". Otherwise response time would reveal which emails are registered.
_DUMMY_HASH = hash_password("timing-equalizer-not-a-real-password")


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: DbSession) -> User:
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=email, full_name=data.full_name, hashed_password=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=Token,
    responses={429: {"description": "Too many failed attempts; see Retry-After"}},
)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession, request: Request
) -> Token:
    """OAuth2 password flow. `username` is the user's email (also powers Swagger's Authorize)."""
    email = form.username.lower()
    ip = request.client.host if request.client else "unknown"

    wait = login_limiter.retry_after(ip, email)
    if wait:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(wait)},
        )

    user = db.scalar(select(User).where(User.email == email))
    password_ok = verify_password(form.password, user.hashed_password if user else _DUMMY_HASH)
    if user is None or not password_ok:
        login_limiter.record_failure(ip, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    login_limiter.record_success(ip, email)
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
