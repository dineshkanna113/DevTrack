from fastapi.testclient import TestClient

from app.models import User, UserRole
from tests.conftest import UserFactory, auth_headers


def test_create_project_makes_creator_owner(client: TestClient, alice: User, project) -> None:
    assert project["key"] == "DT"
    assert project["owner"]["email"] == alice.email
    assert project["open_issues"] == 0

    members = client.get(f"/api/v1/projects/{project['id']}/members", headers=auth_headers(alice))
    assert [(m["user"]["email"], m["role"]) for m in members.json()] == [(alice.email, "owner")]


def test_project_key_is_normalized_and_unique(client: TestClient, alice: User) -> None:
    headers = auth_headers(alice)
    first = client.post("/api/v1/projects", json={"key": "web", "name": "Web"}, headers=headers)
    assert first.json()["key"] == "WEB"
    dup = client.post("/api/v1/projects", json={"key": "WEB", "name": "Again"}, headers=headers)
    assert dup.status_code == 409
    bad = client.post("/api/v1/projects", json={"key": "1-bad", "name": "Bad"}, headers=headers)
    assert bad.status_code == 422


def test_non_members_cannot_see_project(client: TestClient, project, bob: User) -> None:
    headers = auth_headers(bob)
    assert client.get("/api/v1/projects", headers=headers).json() == []
    assert client.get(f"/api/v1/projects/{project['id']}", headers=headers).status_code == 404


def test_admin_sees_all_projects(client: TestClient, project, make_user: UserFactory) -> None:
    admin = make_user(role=UserRole.ADMIN)
    projects = client.get("/api/v1/projects", headers=auth_headers(admin)).json()
    assert [p["key"] for p in projects] == ["DT"]


def test_owner_manages_members(client: TestClient, project, alice: User, bob: User) -> None:
    url = f"/api/v1/projects/{project['id']}/members"
    added = client.post(url, json={"email": bob.email}, headers=auth_headers(alice))
    assert added.status_code == 201
    assert added.json()["role"] == "member"

    again = client.post(url, json={"email": bob.email}, headers=auth_headers(alice))
    assert again.status_code == 409
    missing = client.post(url, json={"email": "ghost@example.com"}, headers=auth_headers(alice))
    assert missing.status_code == 404

    # Bob can now see the project but cannot manage it
    assert client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(bob)).is_success
    forbidden = client.patch(
        f"/api/v1/projects/{project['id']}", json={"name": "Hijack"}, headers=auth_headers(bob)
    )
    assert forbidden.status_code == 403

    cannot_remove_owner = client.delete(f"{url}/{alice.id}", headers=auth_headers(alice))
    assert cannot_remove_owner.status_code == 400
    removed = client.delete(f"{url}/{bob.id}", headers=auth_headers(alice))
    assert removed.status_code == 204
    assert (
        client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(bob)).status_code
        == 404
    )


def test_removing_member_unassigns_their_issues(
    client: TestClient, project_with_bob, alice: User, bob: User
) -> None:
    pid = project_with_bob["id"]
    issue = client.post(
        f"/api/v1/projects/{pid}/issues",
        json={"title": "Fix it", "assignee_id": bob.id},
        headers=auth_headers(alice),
    ).json()
    client.delete(f"/api/v1/projects/{pid}/members/{bob.id}", headers=auth_headers(alice))
    refreshed = client.get(f"/api/v1/issues/{issue['id']}", headers=auth_headers(alice)).json()
    assert refreshed["assignee"] is None


def test_update_and_delete_project(client: TestClient, project, alice: User) -> None:
    url = f"/api/v1/projects/{project['id']}"
    updated = client.patch(url, json={"description": "New"}, headers=auth_headers(alice))
    assert updated.json()["description"] == "New"
    assert updated.json()["name"] == "DevTrack"
    assert client.delete(url, headers=auth_headers(alice)).status_code == 204
    assert client.get(url, headers=auth_headers(alice)).status_code == 404
