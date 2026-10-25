from types import SimpleNamespace
from unittest.mock import MagicMock

import anthropic
import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.routes.ai import get_triager
from app.main import app
from app.models import IssuePriority, IssueType, User
from app.services.ai_triage import (
    ClaudeTriager,
    ExistingIssue,
    TriageError,
    TriageSuggestion,
)
from tests.conftest import auth_headers


class FakeTriager:
    def __init__(
        self, suggestion: TriageSuggestion | None = None, error: TriageError | None = None
    ):
        self.suggestion = suggestion
        self.error = error
        self.calls: list[tuple[str, str, list[ExistingIssue]]] = []

    def triage(self, title: str, description: str, existing: list[ExistingIssue]):
        self.calls.append((title, description, existing))
        if self.error:
            raise self.error
        return self.suggestion


def suggestion(**overrides) -> TriageSuggestion:
    defaults = {
        "type": IssueType.BUG,
        "priority": IssuePriority.HIGH,
        "suggested_title": "Login fails with valid credentials",
        "summary": "Users cannot log in.",
        "reasoning": "Core flow broken with no workaround.",
        "duplicate_issue_ids": [],
    }
    return TriageSuggestion(**{**defaults, **overrides})


@pytest.fixture
def use_triager():
    def install(triager: FakeTriager) -> FakeTriager:
        app.dependency_overrides[get_triager] = lambda: triager
        return triager

    yield install
    app.dependency_overrides.pop(get_triager, None)


def test_triage_disabled_without_api_key(client: TestClient, project, alice: User) -> None:
    response = client.post(
        f"/api/v1/projects/{project['id']}/ai/triage",
        json={"title": "Login broken"},
        headers=auth_headers(alice),
    )
    assert response.status_code == 503


def test_triage_returns_suggestion_with_duplicates(
    client: TestClient, project, alice: User, use_triager
) -> None:
    headers = auth_headers(alice)
    existing = client.post(
        f"/api/v1/projects/{project['id']}/issues",
        json={"title": "Cannot sign in on Safari"},
        headers=headers,
    ).json()
    fake = use_triager(FakeTriager(suggestion(duplicate_issue_ids=[existing["id"], 999])))

    response = client.post(
        f"/api/v1/projects/{project['id']}/ai/triage",
        json={"title": "login dont work", "description": "tried 3 times"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "bug"
    assert body["priority"] == "high"
    # Unknown ids from the model are dropped; known ones are enriched with key + title
    assert body["duplicates"] == [
        {"id": existing["id"], "key": "DT-1", "title": "Cannot sign in on Safari"}
    ]
    title, description, candidates = fake.calls[0]
    assert (title, description) == ("login dont work", "tried 3 times")
    assert [c.key for c in candidates] == ["DT-1"]


def test_triage_maps_service_errors(client: TestClient, project, alice: User, use_triager) -> None:
    use_triager(FakeTriager(error=TriageError("AI service is busy", 429)))
    response = client.post(
        f"/api/v1/projects/{project['id']}/ai/triage",
        json={"title": "Anything here"},
        headers=auth_headers(alice),
    )
    assert response.status_code == 429
    assert response.json()["detail"] == "AI service is busy"


# --- ClaudeTriager unit tests (Anthropic client mocked) --------------------


def make_triager(parse_result=None, parse_error=None) -> tuple[ClaudeTriager, MagicMock]:
    client = MagicMock()
    if parse_error is not None:
        client.beta.messages.parse.side_effect = parse_error
    else:
        client.beta.messages.parse.return_value = parse_result
    return ClaudeTriager(client, "claude-opus-5-5"), client


def test_claude_triager_sends_structured_request() -> None:
    result = SimpleNamespace(
        stop_reason="end_turn", parsed_output=suggestion(duplicate_issue_ids=[1, 42])
    )
    triager, client = make_triager(result)
    existing = [ExistingIssue(id=1, key="DT-1", title="Login broken")]

    out = triager.triage("login broken again", "", existing)

    assert out.duplicate_issue_ids == [1]  # hallucinated id 42 filtered out
    kwargs = client.beta.messages.parse.call_args.kwargs
    assert kwargs["model"] == "claude-opus-5-5"
    assert kwargs["output_format"] is TriageSuggestion
    assert kwargs["fallbacks"] == "default"
    prompt = kwargs["messages"][0]["content"]
    assert '<issue id="1" key="DT-1">Login broken</issue>' in prompt
    assert "<title>login broken again</title>" in prompt


def test_claude_triager_handles_refusal() -> None:
    triager, _ = make_triager(SimpleNamespace(stop_reason="refusal", parsed_output=None))
    with pytest.raises(TriageError) as exc:
        triager.triage("x", "", [])
    assert exc.value.status_code == 422


def _status_error(cls: type[anthropic.APIStatusError], code: int) -> anthropic.APIStatusError:
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("error", response=httpx.Response(code, request=request), body=None)


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (_status_error(anthropic.RateLimitError, 429), 429),
        (_status_error(anthropic.AuthenticationError, 401), 503),
        (_status_error(anthropic.InternalServerError, 500), 502),
        (
            anthropic.APIConnectionError(
                request=httpx.Request("POST", "https://api.anthropic.com")
            ),
            502,
        ),
    ],
)
def test_claude_triager_maps_api_errors(error: Exception, expected_status: int) -> None:
    triager, _ = make_triager(parse_error=error)
    with pytest.raises(TriageError) as exc:
        triager.triage("x", "", [])
    assert exc.value.status_code == expected_status
