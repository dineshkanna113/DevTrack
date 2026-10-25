import os
from collections.abc import Callable, Iterator

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["SECRET_KEY"] = "test-secret-key-at-least-32-bytes-long!!"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import User, UserRole

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)


@event.listens_for(engine, "connect")
def _enable_sqlite_fks(dbapi_connection, _):  # type: ignore[no-untyped-def]
    dbapi_connection.execute("PRAGMA foreign_keys=ON")


TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(autouse=True)
def _schema() -> Iterator[None]:
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db() -> Iterator[Session]:
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


UserFactory = Callable[..., User]


@pytest.fixture
def make_user(db: Session) -> UserFactory:
    counter = 0

    def factory(
        email: str | None = None, full_name: str = "Test User", role: UserRole = UserRole.MEMBER
    ) -> User:
        nonlocal counter
        counter += 1
        user = User(
            email=email or f"user{counter}@example.com",
            full_name=full_name,
            hashed_password=hash_password("password123"),
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return factory


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
def alice(make_user: UserFactory) -> User:
    return make_user(email="alice@example.com", full_name="Alice Owner")


@pytest.fixture
def bob(make_user: UserFactory) -> User:
    return make_user(email="bob@example.com", full_name="Bob Member")


@pytest.fixture
def project(client: TestClient, alice: User) -> dict[str, object]:
    response = client.post(
        "/api/v1/projects",
        json={"key": "DT", "name": "DevTrack", "description": "Main project"},
        headers=auth_headers(alice),
    )
    assert response.status_code == 201
    return response.json()  # type: ignore[no-any-return]


@pytest.fixture
def project_with_bob(client: TestClient, project: dict[str, object], alice: User, bob: User):
    response = client.post(
        f"/api/v1/projects/{project['id']}/members",
        json={"email": bob.email},
        headers=auth_headers(alice),
    )
    assert response.status_code == 201
    return project
