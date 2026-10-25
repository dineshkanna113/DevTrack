from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import Select, case, func, or_, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_membership
from app.models import (
    Activity,
    Issue,
    IssuePriority,
    IssueStatus,
    IssueType,
    Project,
    User,
)
from app.schemas import IssueCreate, IssueUpdate

PRIORITY_RANK = case(
    {p.value: rank for rank, p in enumerate(IssuePriority)}, value=Issue.priority, else_=0
)

SORT_COLUMNS: dict[str, Any] = {
    "created_at": Issue.created_at,
    "updated_at": Issue.updated_at,
    "due_date": Issue.due_date,
    "priority": PRIORITY_RANK,
    "number": Issue.number,
}


NON_NULLABLE_FIELDS = ("title", "description", "status", "priority", "type")


class IssueSort(StrEnum):
    NEWEST = "-created_at"
    OLDEST = "created_at"
    RECENTLY_UPDATED = "-updated_at"
    PRIORITY_DESC = "-priority"
    PRIORITY_ASC = "priority"
    DUE_DATE = "due_date"
    NUMBER = "number"


def _ensure_assignable(db: Session, project_id: int, assignee_id: int | None) -> None:
    if assignee_id is not None and get_membership(db, project_id, assignee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Assignee must be a member of the project",
        )


def _record(db: Session, issue: Issue, actor: User, action: str, **fields: str | None) -> None:
    db.add(Activity(issue_id=issue.id, actor_id=actor.id, action=action, **fields))


def create_issue(db: Session, project: Project, reporter: User, data: IssueCreate) -> Issue:
    _ensure_assignable(db, project.id, data.assignee_id)

    # Atomically reserve the next per-project issue number (DT-1, DT-2, ...).
    number = db.scalar(
        update(Project)
        .where(Project.id == project.id)
        .values(issue_counter=Project.issue_counter + 1)
        .returning(Project.issue_counter)
    )
    if number is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    issue = Issue(
        project_id=project.id, number=number, reporter_id=reporter.id, **data.model_dump()
    )
    db.add(issue)
    db.flush()
    _record(db, issue, reporter, "created")
    db.commit()
    db.refresh(issue)
    return issue


def _display(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, StrEnum):
        return value.value
    return str(value)[:255]


def update_issue(db: Session, issue: Issue, actor: User, data: IssueUpdate) -> Issue:
    # exclude_unset lets clients clear assignee/due_date with an explicit null
    changes = data.model_dump(exclude_unset=True)
    if any(changes.get(field, "") is None for field in NON_NULLABLE_FIELDS):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Field cannot be null"
        )
    if "assignee_id" in changes:
        _ensure_assignable(db, issue.project_id, changes["assignee_id"])

    for field, new in changes.items():
        old = getattr(issue, field)
        if old == new:
            continue
        setattr(issue, field, new)
        if field == "description":
            _record(db, issue, actor, "updated", field=field)
        elif field == "assignee_id":
            old_user = db.get(User, old) if old else None
            new_user = db.get(User, new) if new else None
            _record(
                db,
                issue,
                actor,
                "updated",
                field="assignee",
                old_value=old_user.full_name if old_user else None,
                new_value=new_user.full_name if new_user else None,
            )
        else:
            _record(
                db,
                issue,
                actor,
                "updated",
                field=field,
                old_value=_display(old),
                new_value=_display(new),
            )

    if "status" in changes:
        if issue.status == IssueStatus.DONE and issue.resolved_at is None:
            issue.resolved_at = datetime.now(UTC)
        elif issue.status != IssueStatus.DONE:
            issue.resolved_at = None

    db.commit()
    db.refresh(issue)
    return issue


def build_issue_query(
    project_id: int,
    *,
    statuses: list[IssueStatus] | None = None,
    priorities: list[IssuePriority] | None = None,
    types: list[IssueType] | None = None,
    assignee_id: int | None = None,
    unassigned: bool = False,
    q: str | None = None,
) -> Select[Issue]:
    query = select(Issue).where(Issue.project_id == project_id)
    if statuses:
        query = query.where(Issue.status.in_(statuses))
    if priorities:
        query = query.where(Issue.priority.in_(priorities))
    if types:
        query = query.where(Issue.type.in_(types))
    if unassigned:
        query = query.where(Issue.assignee_id.is_(None))
    elif assignee_id is not None:
        query = query.where(Issue.assignee_id == assignee_id)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(or_(Issue.title.ilike(pattern), Issue.description.ilike(pattern)))
    return query


def paginate_issues(
    db: Session, query: Select[Issue], sort: IssueSort, page: int, page_size: int
) -> tuple[list[Issue], int]:
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    descending = sort.value.startswith("-")
    column = SORT_COLUMNS[sort.value.lstrip("-")]
    order = column.desc() if descending else column.asc()
    items = db.scalars(
        query.order_by(order.nulls_last(), Issue.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(items), total
