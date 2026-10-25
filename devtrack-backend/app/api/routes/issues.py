from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, MemberIssue, MemberProject, get_membership
from app.models import (
    Activity,
    Comment,
    Issue,
    IssuePriority,
    IssueStatus,
    IssueType,
    ProjectRole,
)
from app.schemas import (
    ActivityOut,
    CommentCreate,
    CommentOut,
    IssueCreate,
    IssueOut,
    IssuePage,
    IssueUpdate,
)
from app.services import issues as issue_service
from app.services.issues import IssueSort

router = APIRouter(tags=["issues"])


@router.get("/projects/{project_id}/issues", response_model=IssuePage)
def list_issues(
    project: MemberProject,
    db: DbSession,
    status_: Annotated[list[IssueStatus] | None, Query(alias="status")] = None,
    priority: Annotated[list[IssuePriority] | None, Query()] = None,
    type_: Annotated[list[IssueType] | None, Query(alias="type")] = None,
    assignee_id: int | None = None,
    unassigned: bool = False,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: IssueSort = IssueSort.NEWEST,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 20,
) -> IssuePage:
    query = issue_service.build_issue_query(
        project.id,
        statuses=status_,
        priorities=priority,
        types=type_,
        assignee_id=assignee_id,
        unassigned=unassigned,
        q=q,
    )
    items, total = issue_service.paginate_issues(db, query, sort, page, page_size)
    return IssuePage(
        items=[IssueOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/projects/{project_id}/issues", response_model=IssueOut, status_code=status.HTTP_201_CREATED
)
def create_issue(
    data: IssueCreate, project: MemberProject, db: DbSession, user: CurrentUser
) -> Issue:
    return issue_service.create_issue(db, project, user, data)


@router.get("/issues/assigned-to-me", response_model=list[IssueOut])
def my_open_issues(db: DbSession, user: CurrentUser) -> list[Issue]:
    return list(
        db.scalars(
            select(Issue)
            .where(Issue.assignee_id == user.id, Issue.status != IssueStatus.DONE)
            .order_by(issue_service.PRIORITY_RANK.desc(), Issue.due_date.asc().nulls_last())
            .limit(50)
        )
    )


@router.get("/issues/{issue_id}", response_model=IssueOut)
def get_issue(issue: MemberIssue) -> Issue:
    return issue


@router.patch("/issues/{issue_id}", response_model=IssueOut)
def update_issue(data: IssueUpdate, issue: MemberIssue, db: DbSession, user: CurrentUser) -> Issue:
    return issue_service.update_issue(db, issue, user, data)


@router.delete("/issues/{issue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_issue(issue: MemberIssue, db: DbSession, user: CurrentUser) -> Response:
    membership = get_membership(db, issue.project_id, user.id)
    is_owner = membership is not None and membership.role == ProjectRole.OWNER
    if not (user.is_admin or is_owner or issue.reporter_id == user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the reporter or a project owner can delete this issue",
        )
    db.delete(issue)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/issues/{issue_id}/comments", response_model=list[CommentOut])
def list_comments(issue: MemberIssue, db: DbSession) -> list[Comment]:
    return list(
        db.scalars(select(Comment).where(Comment.issue_id == issue.id).order_by(Comment.created_at))
    )


@router.post(
    "/issues/{issue_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED
)
def add_comment(
    data: CommentCreate, issue: MemberIssue, db: DbSession, user: CurrentUser
) -> Comment:
    comment = Comment(issue_id=issue.id, author_id=user.id, body=data.body)
    db.add(comment)
    db.add(Activity(issue_id=issue.id, actor_id=user.id, action="commented"))
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: DbSession, user: CurrentUser) -> Response:
    comment = db.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.author_id != user.id and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own comments"
        )
    db.delete(comment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/issues/{issue_id}/activity", response_model=list[ActivityOut])
def list_activity(issue: MemberIssue, db: DbSession) -> list[Activity]:
    return list(
        db.scalars(
            select(Activity)
            .where(Activity.issue_id == issue.id)
            .order_by(Activity.created_at.desc(), Activity.id.desc())
        )
    )
