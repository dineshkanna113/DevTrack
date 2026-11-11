from fastapi.testclient import TestClient

from app.core.rate_limit import LoginRateLimiter
from app.models import User


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_limiter_blocks_after_max_failures_then_expires() -> None:
    clock = FakeClock()
    limiter = LoginRateLimiter(max_failures_per_account=3, window_seconds=60, clock=clock)
    for _ in range(3):
        assert limiter.retry_after("1.1.1.1", "a@x.com") == 0
        limiter.record_failure("1.1.1.1", "a@x.com")
    assert limiter.retry_after("1.1.1.1", "a@x.com") == 60
    # other accounts and other IPs are unaffected
    assert limiter.retry_after("1.1.1.1", "b@x.com") == 0
    assert limiter.retry_after("2.2.2.2", "a@x.com") == 0

    clock.now += 45
    assert limiter.retry_after("1.1.1.1", "a@x.com") == 15
    clock.now += 15
    assert limiter.retry_after("1.1.1.1", "a@x.com") == 0


def test_limiter_caps_one_ip_spraying_many_accounts() -> None:
    limiter = LoginRateLimiter(max_failures_per_account=5, max_failures_per_ip=4, clock=FakeClock())
    for i in range(4):
        limiter.record_failure("9.9.9.9", f"user{i}@x.com")
    assert limiter.retry_after("9.9.9.9", "fresh@x.com") > 0


def test_success_clears_account_counter() -> None:
    limiter = LoginRateLimiter(max_failures_per_account=2, clock=FakeClock())
    limiter.record_failure("1.1.1.1", "a@x.com")
    limiter.record_success("1.1.1.1", "a@x.com")
    limiter.record_failure("1.1.1.1", "a@x.com")
    assert limiter.retry_after("1.1.1.1", "a@x.com") == 0


def login(client: TestClient, email: str, password: str) -> int:
    return client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).status_code


def test_login_endpoint_returns_429_with_retry_after(client: TestClient, alice: User) -> None:
    for _ in range(5):
        assert login(client, alice.email, "wrong-password") == 401
    response = client.post(
        "/api/v1/auth/login", data={"username": alice.email, "password": "password123"}
    )
    # even the correct password is refused while locked out
    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) > 0


def test_unknown_emails_count_as_failures(client: TestClient) -> None:
    for _ in range(5):
        assert login(client, "nobody@example.com", "whatever-pass") == 401
    assert login(client, "nobody@example.com", "whatever-pass") == 429
