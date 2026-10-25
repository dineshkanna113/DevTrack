from fastapi.testclient import TestClient


def test_health_reports_database_and_ai_status(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
        "ai_enabled": False,
        "version": "2.0.0",
    }
    assert "X-Request-ID" in response.headers


def test_request_id_is_propagated(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-ID": "abc123"})
    assert response.headers["X-Request-ID"] == "abc123"


def test_openapi_schema_lists_core_routes(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    for path in (
        "/api/v1/auth/login",
        "/api/v1/projects/{project_id}/issues",
        "/api/v1/projects/{project_id}/ai/triage",
    ):
        assert path in paths
