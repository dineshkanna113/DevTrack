from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.models import User
from tests.conftest import auth_headers


def register(client: TestClient, email: str = "new@example.com", password: str = "s3cretpass"):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "New User", "password": password},
    )


def test_register_and_login_flow(client: TestClient) -> None:
    response = register(client, email="New@Example.com")
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["role"] == "member"
    assert "hashed_password" not in body

    login = client.post(
        "/api/v1/auth/login", data={"username": "NEW@example.com", "password": "s3cretpass"}
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "new@example.com"


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    assert register(client).status_code == 201
    response = register(client, email="NEW@example.com")
    assert response.status_code == 409


def test_register_rejects_short_password(client: TestClient) -> None:
    assert register(client, password="short").status_code == 422


def test_login_rejects_bad_password(client: TestClient, alice: User) -> None:
    response = client.post(
        "/api/v1/auth/login", data={"username": alice.email, "password": "wrong-password"}
    )
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_me_requires_token(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_rejects_garbage_and_expired_tokens(client: TestClient, alice: User) -> None:
    garbage = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert garbage.status_code == 401

    expired = create_access_token(alice.id, expires_delta=timedelta(minutes=-1))
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401


def test_disabled_user_cannot_authenticate(client: TestClient, alice: User, db) -> None:
    alice.is_active = False
    db.merge(alice)
    db.commit()
    assert client.get("/api/v1/auth/me", headers=auth_headers(alice)).status_code == 401
    login = client.post(
        "/api/v1/auth/login", data={"username": alice.email, "password": "password123"}
    )
    assert login.status_code == 403
