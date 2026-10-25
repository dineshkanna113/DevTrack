"""Legacy v1 schema (users + issues), as created by the original `create_all()`.

Existing v1 databases already have these tables: run `alembic stamp 0001` once,
then `alembic upgrade head` to migrate them. Fresh databases just run upgrade.

Revision ID: 0001
Revises:
Create Date: 2025-06-01
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="users_pkey"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "issues",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("assigned_to", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name="issues_owner_id_fkey"),
        sa.PrimaryKeyConstraint("id", name="issues_pkey"),
    )
    op.create_index("ix_issues_id", "issues", ["id"])


def downgrade() -> None:
    op.drop_table("issues")
    op.drop_table("users")
