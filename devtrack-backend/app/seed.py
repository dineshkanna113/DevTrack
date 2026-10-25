"""Populate the database with a demo workspace.

Usage:  python -m app.seed            (idempotent: skips if the demo user exists)
        python -m app.seed --reset    (deletes the demo data and recreates it)

Demo login: demo@devtrack.dev / DemoPass123!
"""

import argparse
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    Activity,
    Comment,
    Issue,
    IssuePriority,
    IssueStatus,
    IssueType,
    Project,
    ProjectMember,
    ProjectRole,
    User,
)

DEMO_EMAIL = "demo@devtrack.dev"
DEMO_PASSWORD = "DemoPass123!"  # noqa: S105  (public demo account)

TEAM = [
    (DEMO_EMAIL, "Demo User"),
    ("priya@devtrack.dev", "Priya Sharma"),
    ("marcus@devtrack.dev", "Marcus Lee"),
    ("sofia@devtrack.dev", "Sofia Alvarez"),
]

S, P, T = IssueStatus, IssuePriority, IssueType
ISSUES: dict[str, list[tuple[str, str, IssueType, IssuePriority, IssueStatus]]] = {
    "DT": [
        (
            "Login fails when email has uppercase letters",
            "Users who registered with Mixed@Case.com get 'invalid credentials'.",
            T.BUG,
            P.CRITICAL,
            S.DONE,
        ),
        (
            "Add Kanban drag-and-drop",
            "Let users move cards between columns.",
            T.FEATURE,
            P.HIGH,
            S.DONE,
        ),
        (
            "Dashboard charts take 8s to load",
            "Stats endpoint does N+1 queries.",
            T.BUG,
            P.HIGH,
            S.IN_REVIEW,
        ),
        (
            "AI triage: suggest priority for new issues",
            "Use Claude to classify drafts.",
            T.FEATURE,
            P.HIGH,
            S.IN_PROGRESS,
        ),
        (
            "Session expires without warning",
            "Show a toast before the JWT expires.",
            T.IMPROVEMENT,
            P.MEDIUM,
            S.TODO,
        ),
        (
            "Export issues to CSV",
            "Requested by the PM team for weekly reports.",
            T.FEATURE,
            P.LOW,
            S.TODO,
        ),
        ("Upgrade SQLAlchemy to 2.1", "Typed Select API and faster ORM.", T.TASK, P.MEDIUM, S.DONE),
        (
            "Mobile layout breaks on issue detail",
            "Sidebar overlaps content under 400px.",
            T.BUG,
            P.MEDIUM,
            S.IN_PROGRESS,
        ),
        (
            "Add rate limiting to /auth/login",
            "Prevent credential stuffing.",
            T.TASK,
            P.HIGH,
            S.TODO,
        ),
        (
            "Dark mode contrast too low on badges",
            "WCAG AA fails for low-priority badge.",
            T.BUG,
            P.LOW,
            S.TODO,
        ),
        (
            "Set up GitHub Actions CI",
            "Lint, type-check, test on every PR.",
            T.TASK,
            P.MEDIUM,
            S.DONE,
        ),
        (
            "Email notifications on assignment",
            "Notify assignee when an issue is assigned.",
            T.FEATURE,
            P.MEDIUM,
            S.TODO,
        ),
        (
            "Comment timestamps show UTC",
            "Should render in the viewer's timezone.",
            T.BUG,
            P.LOW,
            S.IN_REVIEW,
        ),
        ("Search ignores issue descriptions", "Only titles are matched.", T.BUG, P.MEDIUM, S.DONE),
    ],
    "MOB": [
        (
            "Push notifications on Android 15",
            "Permission prompt never appears.",
            T.BUG,
            P.HIGH,
            S.IN_PROGRESS,
        ),
        ("Offline mode for issue list", "Cache last-viewed issues.", T.FEATURE, P.MEDIUM, S.TODO),
        (
            "App crashes on logout (iOS)",
            "Null token in keychain cleanup.",
            T.BUG,
            P.CRITICAL,
            S.IN_REVIEW,
        ),
        ("Reduce bundle size below 20MB", "Strip unused locales.", T.IMPROVEMENT, P.LOW, S.TODO),
        ("Biometric login", "Face ID / fingerprint sign-in.", T.FEATURE, P.MEDIUM, S.DONE),
    ],
}

COMMENTS = [
    "Reproduced on staging, looking into it.",
    "I think this is related to the token refresh change last week.",
    "PR is up, would appreciate a review.",
    "Can we add a regression test for this?",
    "Confirmed fixed on main.",
]


def _reset(db: Session) -> None:
    emails = [email for email, _ in TEAM]
    db.execute(delete(Project).where(Project.key.in_(list(ISSUES))))
    db.execute(delete(User).where(User.email.in_(emails)))
    db.commit()


def seed(db: Session, reset: bool = False) -> bool:
    if reset:
        _reset(db)
    if db.scalar(select(User).where(User.email == DEMO_EMAIL)):
        return False

    rng = random.Random(42)
    users = [
        User(email=email, full_name=name, hashed_password=hash_password(DEMO_PASSWORD))
        for email, name in TEAM
    ]
    db.add_all(users)
    db.flush()
    demo = users[0]

    projects = {
        "DT": Project(
            key="DT",
            name="DevTrack Platform",
            owner_id=demo.id,
            description="Web app and API for DevTrack.",
        ),
        "MOB": Project(
            key="MOB", name="Mobile App", owner_id=demo.id, description="iOS and Android clients."
        ),
    }
    now = datetime.now(UTC)
    for key, project in projects.items():
        db.add(project)
        db.flush()
        for user in users:
            role = ProjectRole.OWNER if user is demo else ProjectRole.MEMBER
            db.add(ProjectMember(project_id=project.id, user_id=user.id, role=role))

        for number, (title, description, type_, priority, status) in enumerate(
            ISSUES[key], start=1
        ):
            created = now - timedelta(days=rng.randint(0, 13), hours=rng.randint(0, 20))
            reporter = rng.choice(users)
            issue = Issue(
                project_id=project.id,
                number=number,
                title=title,
                description=description,
                type=type_,
                priority=priority,
                status=status,
                reporter_id=reporter.id,
                assignee_id=rng.choice(users).id if rng.random() < 0.85 else None,
                created_at=created,
                updated_at=created,
                due_date=(now + timedelta(days=rng.randint(-3, 21))).date()
                if rng.random() < 0.5
                else None,
                resolved_at=min(created + timedelta(days=rng.randint(0, 4)), now)
                if status == IssueStatus.DONE
                else None,
            )
            db.add(issue)
            db.flush()
            db.add(
                Activity(
                    issue_id=issue.id, actor_id=reporter.id, action="created", created_at=created
                )
            )
            for i in range(rng.randint(0, 3)):
                author = rng.choice(users)
                db.add(
                    Comment(
                        issue_id=issue.id,
                        author_id=author.id,
                        body=COMMENTS[i],
                        created_at=created + timedelta(hours=i + 1),
                    )
                )
        project.issue_counter = len(ISSUES[key])

    db.commit()
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="recreate the demo data")
    args = parser.parse_args()
    with SessionLocal() as db:
        created = seed(db, reset=args.reset)
    print("Seeded demo data." if created else "Demo data already present; use --reset.")
    print(f"Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
