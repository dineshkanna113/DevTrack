from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Issue, IssuePriority, IssueStatus, IssueType, User
from app.schemas import AssigneeCount, DailyCount, ProjectStats, UserBrief


def _as_date(value: datetime) -> date:
    # SQLite returns naive datetimes; Postgres returns aware ones. Normalize to UTC dates.
    if value.tzinfo is not None:
        value = value.astimezone(UTC)
    return value.date()


def project_stats(db: Session, project_id: int, days: int = 14) -> ProjectStats:
    in_project = Issue.project_id == project_id

    def grouped(column: object) -> dict[str, int]:
        rows = db.execute(
            select(column, func.count()).where(in_project).group_by(column)  # type: ignore[call-overload]
        ).all()
        return {str(key.value if hasattr(key, "value") else key): count for key, count in rows}

    by_status = grouped(Issue.status)
    by_priority = grouped(Issue.priority)
    by_type = grouped(Issue.type)

    today = datetime.now(UTC).date()
    overdue = (
        db.scalar(
            select(func.count()).where(
                in_project, Issue.status != IssueStatus.DONE, Issue.due_date < today
            )
        )
        or 0
    )

    assignee_rows = db.execute(
        select(Issue.assignee_id, func.count())
        .where(in_project, Issue.status != IssueStatus.DONE)
        .group_by(Issue.assignee_id)
        .order_by(func.count().desc())
    ).all()
    users = {
        u.id: u
        for u in db.scalars(
            select(User).where(User.id.in_([uid for uid, _ in assignee_rows if uid]))
        )
    }
    open_by_assignee = [
        AssigneeCount(
            user=UserBrief.model_validate(users[uid]) if uid in users else None, count=count
        )
        for uid, count in assignee_rows
    ]

    start = today - timedelta(days=days - 1)
    since = datetime.combine(start, datetime.min.time(), tzinfo=UTC)
    created = db.scalars(select(Issue.created_at).where(in_project, Issue.created_at >= since))
    resolved = db.scalars(select(Issue.resolved_at).where(in_project, Issue.resolved_at >= since))
    daily = {start + timedelta(days=i): [0, 0] for i in range(days)}
    for ts in created:
        if (d := _as_date(ts)) in daily:
            daily[d][0] += 1
    for resolved_at in resolved:
        if resolved_at is not None and (d := _as_date(resolved_at)) in daily:
            daily[d][1] += 1

    total = sum(by_status.values())
    done = by_status.get(IssueStatus.DONE.value, 0)
    return ProjectStats(
        total=total,
        open=total - done,
        done=done,
        overdue=overdue,
        by_status={s: by_status.get(s.value, 0) for s in IssueStatus},
        by_priority={p: by_priority.get(p.value, 0) for p in IssuePriority},
        by_type={t: by_type.get(t.value, 0) for t in IssueType},
        open_by_assignee=open_by_assignee,
        daily=[DailyCount(date=d, created=c, resolved=r) for d, (c, r) in daily.items()],
    )
