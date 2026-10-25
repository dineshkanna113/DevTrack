"""v2: projects, membership, issue workflow, comments, activity log.

Data migration: every v1 user who owns issues gets a personal project (key DT<id>);
their issues move into it with per-project numbers. Statuses map open->todo and
closed->done; the old free-text label maps to type, with "urgent" becoming a task
with critical priority; `assigned_to` emails are resolved to user ids where possible.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOW = sa.text("CURRENT_TIMESTAMP")
LEGACY_TYPES = {"bug", "feature", "task"}


def _timestamp(name: str, nullable: bool = False) -> sa.Column[object]:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        nullable=nullable,
        server_default=None if nullable else NOW,
    )


def upgrade() -> None:
    # --- users --------------------------------------------------------------
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "password", new_column_name="hashed_password", type_=sa.String(255)
        )
        batch.alter_column("email", type_=sa.String(255))
        batch.add_column(sa.Column("full_name", sa.String(100), nullable=True))
        batch.add_column(
            sa.Column("role", sa.String(20), nullable=False, server_default="member")
        )
        batch.add_column(
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch.add_column(_timestamp("created_at"))
        batch.drop_index("ix_users_id")
    # v2 normalizes emails to lowercase at register/login, so existing rows must match
    op.execute("UPDATE users SET full_name = email, email = LOWER(email)")
    with op.batch_alter_table("users") as batch:
        batch.alter_column("full_name", existing_type=sa.String(100), nullable=False)

    # --- new tables ---------------------------------------------------------
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(10), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("issue_counter", sa.Integer(), nullable=False, server_default="0"),
        _timestamp("created_at"),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name="fk_projects_owner_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_projects"),
    )
    op.create_index("ix_projects_key", "projects", ["key"], unique=True)

    op.create_table(
        "project_members",
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        _timestamp("joined_at"),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name="fk_project_members_project_id_projects",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_project_members_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("project_id", "user_id", name="pk_project_members"),
    )

    # --- issues: add new columns, migrate data, then tighten ----------------
    with op.batch_alter_table("issues") as batch:
        batch.add_column(sa.Column("project_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("number", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("priority", sa.String(20), nullable=True))
        batch.add_column(sa.Column("type", sa.String(20), nullable=True))
        batch.add_column(sa.Column("reporter_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("assignee_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("due_date", sa.Date(), nullable=True))
        batch.add_column(_timestamp("created_at"))
        batch.add_column(_timestamp("updated_at"))
        batch.add_column(_timestamp("resolved_at", nullable=True))

    _migrate_issue_data()

    with op.batch_alter_table("issues") as batch:
        batch.drop_index("ix_issues_id")
        batch.drop_constraint("issues_owner_id_fkey", type_="foreignkey")
        batch.drop_column("owner_id")
        batch.drop_column("label")
        batch.drop_column("assigned_to")
        batch.alter_column("project_id", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("number", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("priority", existing_type=sa.String(20), nullable=False)
        batch.alter_column("type", existing_type=sa.String(20), nullable=False)
        batch.alter_column("title", type_=sa.String(200))
        batch.alter_column("description", type_=sa.Text(), nullable=False)
        batch.alter_column("status", type_=sa.String(20))
        batch.create_foreign_key(
            "fk_issues_project_id_projects", "projects", ["project_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_foreign_key(
            "fk_issues_reporter_id_users", "users", ["reporter_id"], ["id"], ondelete="SET NULL"
        )
        batch.create_foreign_key(
            "fk_issues_assignee_id_users", "users", ["assignee_id"], ["id"], ondelete="SET NULL"
        )
        batch.create_unique_constraint("uq_issues_project_id_number", ["project_id", "number"])
        batch.create_index("ix_issues_project_id_status", ["project_id", "status"])
        batch.create_index("ix_issues_reporter_id", ["reporter_id"])
        batch.create_index("ix_issues_assignee_id", ["assignee_id"])

    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("issue_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        _timestamp("created_at"),
        sa.ForeignKeyConstraint(
            ["issue_id"], ["issues.id"], name="fk_comments_issue_id_issues", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], name="fk_comments_author_id_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_comments"),
    )
    op.create_index("ix_comments_issue_id", "comments", ["issue_id"])

    op.create_table(
        "activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("issue_id", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("field", sa.String(50), nullable=True),
        sa.Column("old_value", sa.String(255), nullable=True),
        sa.Column("new_value", sa.String(255), nullable=True),
        _timestamp("created_at"),
        sa.ForeignKeyConstraint(
            ["issue_id"], ["issues.id"], name="fk_activities_issue_id_issues", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name="fk_activities_actor_id_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_activities"),
    )
    op.create_index("ix_activities_issue_id", "activities", ["issue_id"])


def _migrate_issue_data() -> None:
    conn = op.get_bind()
    # v1 issues without a valid owner were invisible to everyone; drop them.
    conn.execute(
        sa.text(
            "DELETE FROM issues WHERE owner_id IS NULL "
            "OR owner_id NOT IN (SELECT id FROM users)"
        )
    )
    users_by_email = {
        email.lower(): uid
        for email, uid in conn.execute(sa.text("SELECT email, id FROM users")).all()
    }
    owner_ids = conn.execute(
        sa.text("SELECT DISTINCT owner_id FROM issues ORDER BY owner_id")
    ).scalars()

    for owner_id in list(owner_ids):
        project_id = conn.execute(
            sa.text(
                "INSERT INTO projects (key, name, description, owner_id, issue_counter) "
                "VALUES (:key, 'My Issues', 'Migrated from DevTrack v1', :owner, 0) "
                "RETURNING id"
            ),
            {"key": f"DT{owner_id}"[:10], "owner": owner_id},
        ).scalar_one()
        conn.execute(
            sa.text(
                "INSERT INTO project_members (project_id, user_id, role) "
                "VALUES (:project, :user, 'owner')"
            ),
            {"project": project_id, "user": owner_id},
        )

        rows = conn.execute(
            sa.text(
                "SELECT id, status, label, assigned_to FROM issues "
                "WHERE owner_id = :owner ORDER BY id"
            ),
            {"owner": owner_id},
        ).all()
        for number, (issue_id, status, label, assigned_to) in enumerate(rows, start=1):
            label = (label or "").lower()
            done = (status or "").lower() == "closed"
            conn.execute(
                sa.text(
                    "UPDATE issues SET project_id = :project, number = :number, "
                    "status = :status, type = :type, priority = :priority, "
                    "reporter_id = :owner, assignee_id = :assignee, "
                    "description = COALESCE(description, ''), "
                    "title = SUBSTR(title, 1, 200), "
                    "resolved_at = CASE WHEN :done THEN CURRENT_TIMESTAMP ELSE NULL END "
                    "WHERE id = :id"
                ),
                {
                    "project": project_id,
                    "number": number,
                    "status": "done" if done else "todo",
                    "type": label if label in LEGACY_TYPES else "task",
                    "priority": "critical" if label == "urgent" else "medium",
                    "owner": owner_id,
                    "assignee": users_by_email.get((assigned_to or "").lower()),
                    "done": done,
                    "id": issue_id,
                },
            )
        conn.execute(
            sa.text("UPDATE projects SET issue_counter = :n WHERE id = :id"),
            {"n": len(rows), "id": project_id},
        )


def downgrade() -> None:
    """Best-effort return to the v1 schema. Project structure, comments and activity are lost."""
    op.drop_table("activities")
    op.drop_table("comments")

    with op.batch_alter_table("issues") as batch:
        batch.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("label", sa.String(), nullable=False, server_default="task"))
        batch.add_column(
            sa.Column("assigned_to", sa.String(), nullable=False, server_default="unassigned")
        )
    op.execute(
        "UPDATE issues SET owner_id = reporter_id, label = type, "
        "status = CASE WHEN status = 'done' THEN 'closed' ELSE 'open' END, "
        "assigned_to = COALESCE((SELECT email FROM users WHERE users.id = issues.assignee_id), "
        "'unassigned')"
    )
    with op.batch_alter_table("issues") as batch:
        batch.drop_constraint("uq_issues_project_id_number", type_="unique")
        batch.drop_constraint("fk_issues_project_id_projects", type_="foreignkey")
        batch.drop_constraint("fk_issues_reporter_id_users", type_="foreignkey")
        batch.drop_constraint("fk_issues_assignee_id_users", type_="foreignkey")
        batch.drop_index("ix_issues_project_id_status")
        batch.drop_index("ix_issues_reporter_id")
        batch.drop_index("ix_issues_assignee_id")
        for column in (
            "project_id", "number", "priority", "type", "reporter_id", "assignee_id",
            "due_date", "created_at", "updated_at", "resolved_at",
        ):
            batch.drop_column(column)
        batch.create_foreign_key("issues_owner_id_fkey", "users", ["owner_id"], ["id"])
        batch.create_index("ix_issues_id", ["id"])

    op.drop_table("project_members")
    op.drop_table("projects")

    with op.batch_alter_table("users") as batch:
        for column in ("full_name", "role", "is_active", "created_at"):
            batch.drop_column(column)
        batch.alter_column("hashed_password", new_column_name="password")
        batch.create_index("ix_users_id", ["id"])
