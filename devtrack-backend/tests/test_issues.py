from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.models import User
from tests.conftest import UserFactory, auth_headers


def create(client: TestClient, project_id: int, user: User, **fields):
    payload = {"title": "Something is broken", **fields}
    response = client.post(
        f"/api/v1/projects/{project_id}/issues", json=payload, headers=auth_headers(user)
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_issue_keys_increment_per_project(client: TestClient, project, alice: User) -> None:
    first = create(client, project["id"], alice)
    second = create(client, project["id"], alice, type="bug", priority="high")
    assert (first["key"], second["key"]) == ("DT-1", "DT-2")
    assert second["type"] == "bug"
    assert second["status"] == "todo"
    assert second["reporter"]["email"] == alice.email

    other = client.post(
        "/api/v1/projects", json={"key": "OPS", "name": "Ops"}, headers=auth_headers(alice)
    ).json()
    assert create(client, other["id"], alice)["key"] == "OPS-1"


def test_non_member_cannot_create_or_read(client: TestClient, project, alice: User, bob) -> None:
    issue = create(client, project["id"], alice)
    response = client.post(
        f"/api/v1/projects/{project['id']}/issues",
        json={"title": "Sneaky"},
        headers=auth_headers(bob),
    )
    assert response.status_code == 404
    assert client.get(f"/api/v1/issues/{issue['id']}", headers=auth_headers(bob)).status_code == 404


def test_assignee_must_be_member(client: TestClient, project, alice: User, bob: User) -> None:
    response = client.post(
        f"/api/v1/projects/{project['id']}/issues",
        json={"title": "Assign to outsider", "assignee_id": bob.id},
        headers=auth_headers(alice),
    )
    assert response.status_code == 422


def test_update_records_activity_and_resolution(
    client: TestClient, project_with_bob, alice: User, bob: User
) -> None:
    issue = create(client, project_with_bob["id"], alice)
    url = f"/api/v1/issues/{issue['id']}"

    done = client.patch(
        url, json={"status": "done", "assignee_id": bob.id}, headers=auth_headers(bob)
    ).json()
    assert done["status"] == "done"
    assert done["resolved_at"] is not None
    assert done["assignee"]["id"] == bob.id

    reopened = client.patch(url, json={"status": "in_progress"}, headers=auth_headers(bob)).json()
    assert reopened["resolved_at"] is None

    unassigned = client.patch(url, json={"assignee_id": None}, headers=auth_headers(bob)).json()
    assert unassigned["assignee"] is None

    activity = client.get(f"{url}/activity", headers=auth_headers(alice)).json()
    summary = [(a["action"], a["field"], a["old_value"], a["new_value"]) for a in activity]
    assert summary == [
        ("updated", "assignee", "Bob Member", None),
        ("updated", "status", "done", "in_progress"),
        ("updated", "assignee", None, "Bob Member"),
        ("updated", "status", "todo", "done"),
        ("created", None, None, None),
    ]


def test_update_rejects_null_for_required_fields(client: TestClient, project, alice: User) -> None:
    issue = create(client, project["id"], alice)
    response = client.patch(
        f"/api/v1/issues/{issue['id']}", json={"title": None}, headers=auth_headers(alice)
    )
    assert response.status_code == 422


def test_noop_update_records_nothing(client: TestClient, project, alice: User) -> None:
    issue = create(client, project["id"], alice, priority="high")
    url = f"/api/v1/issues/{issue['id']}"
    client.patch(url, json={"priority": "high"}, headers=auth_headers(alice))
    assert len(client.get(f"{url}/activity", headers=auth_headers(alice)).json()) == 1


@pytest.fixture
def seeded(client: TestClient, project_with_bob, alice: User, bob: User):
    pid = project_with_bob["id"]
    create(client, pid, alice, title="Login page crashes", type="bug", priority="critical")
    create(client, pid, alice, title="Add CSV export", type="feature", priority="low")
    create(client, pid, alice, title="Refactor auth module", priority="medium", assignee_id=bob.id)
    create(
        client,
        pid,
        alice,
        title="Slow dashboard",
        description="Charts take 10s to load",
        type="improvement",
        priority="high",
        due_date=str(date.today() - timedelta(days=1)),
    )
    return pid


def list_issues(client: TestClient, pid: int, user: User, **params):
    response = client.get(
        f"/api/v1/projects/{pid}/issues", params=params, headers=auth_headers(user)
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_list_filters_and_search(client: TestClient, seeded, alice: User, bob: User) -> None:
    def titles(**params) -> set[str]:
        return {i["title"] for i in list_issues(client, seeded, alice, **params)["items"]}

    assert titles(type="bug") == {"Login page crashes"}
    assert titles(priority=["high", "critical"]) == {"Login page crashes", "Slow dashboard"}
    assert titles(assignee_id=bob.id) == {"Refactor auth module"}
    assert len(titles(unassigned=True)) == 3
    assert titles(q="charts") == {"Slow dashboard"}  # matches description
    assert titles(q="LOGIN") == {"Login page crashes"}  # case-insensitive


def test_list_sorting_and_pagination(client: TestClient, seeded, alice: User) -> None:
    by_priority = list_issues(client, seeded, alice, sort="-priority")["items"]
    assert [i["priority"] for i in by_priority] == ["critical", "high", "medium", "low"]

    page = list_issues(client, seeded, alice, page=2, page_size=3, sort="number")
    assert page["total"] == 4
    assert page["pages"] == 2
    assert [i["key"] for i in page["items"]] == ["DT-4"]


def test_assigned_to_me(client: TestClient, seeded, bob: User) -> None:
    mine = client.get("/api/v1/issues/assigned-to-me", headers=auth_headers(bob)).json()
    assert [i["title"] for i in mine] == ["Refactor auth module"]


def test_delete_permissions(
    client: TestClient, project_with_bob, alice: User, bob: User, make_user: UserFactory
) -> None:
    pid = project_with_bob["id"]
    alices = create(client, pid, alice)
    bobs = create(client, pid, bob)

    # Members can't delete other people's issues; owners and reporters can.
    assert (
        client.delete(f"/api/v1/issues/{alices['id']}", headers=auth_headers(bob)).status_code
        == 403
    )
    assert (
        client.delete(f"/api/v1/issues/{bobs['id']}", headers=auth_headers(bob)).status_code == 204
    )
    assert (
        client.delete(f"/api/v1/issues/{alices['id']}", headers=auth_headers(alice)).status_code
        == 204
    )


def test_comments(client: TestClient, project_with_bob, alice: User, bob: User) -> None:
    issue = create(client, project_with_bob["id"], alice)
    url = f"/api/v1/issues/{issue['id']}/comments"

    posted = client.post(url, json={"body": "  Repro'd on Chrome  "}, headers=auth_headers(bob))
    assert posted.status_code == 201
    assert posted.json()["body"] == "Repro'd on Chrome"
    assert client.post(url, json={"body": "   "}, headers=auth_headers(bob)).status_code == 422

    comments = client.get(url, headers=auth_headers(alice)).json()
    assert [c["author"]["email"] for c in comments] == [bob.email]

    comment_url = f"/api/v1/comments/{comments[0]['id']}"
    assert client.delete(comment_url, headers=auth_headers(alice)).status_code == 403
    assert client.delete(comment_url, headers=auth_headers(bob)).status_code == 204
    assert client.delete(comment_url, headers=auth_headers(bob)).status_code == 404

    actions = [
        a["action"]
        for a in client.get(
            f"/api/v1/issues/{issue['id']}/activity", headers=auth_headers(alice)
        ).json()
    ]
    assert actions == ["commented", "created"]


def test_stats(client: TestClient, seeded, alice: User, bob: User) -> None:
    first = list_issues(client, seeded, alice, sort="number")["items"][0]
    client.patch(
        f"/api/v1/issues/{first['id']}", json={"status": "done"}, headers=auth_headers(alice)
    )

    stats = client.get(f"/api/v1/projects/{seeded}/stats", headers=auth_headers(alice)).json()
    assert (stats["total"], stats["open"], stats["done"], stats["overdue"]) == (4, 3, 1, 1)
    assert stats["by_status"] == {"todo": 3, "in_progress": 0, "in_review": 0, "done": 1}
    assert stats["by_type"]["bug"] == 1
    assert len(stats["daily"]) == 14
    assert stats["daily"][-1] == {"date": str(date.today()), "created": 4, "resolved": 1}

    by_assignee = {
        (row["user"]["email"] if row["user"] else None): row["count"]
        for row in stats["open_by_assignee"]
    }
    assert by_assignee == {None: 2, bob.email: 1}

    project = client.get(f"/api/v1/projects/{seeded}", headers=auth_headers(alice)).json()
    assert (project["total_issues"], project["open_issues"]) == (4, 3)
