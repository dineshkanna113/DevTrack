from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import case, func, select

from app.api.deps import CurrentUser, DbSession, MemberProject, OwnedProject, get_membership
from app.models import Issue, IssueStatus, Project, ProjectMember, ProjectRole, User
from app.schemas import (
    MemberAdd,
    MemberOut,
    ProjectCreate,
    ProjectOut,
    ProjectStats,
    ProjectUpdate,
)
from app.services.stats import project_stats

router = APIRouter(prefix="/projects", tags=["projects"])


def _with_counts(db: DbSession, projects: list[Project]) -> list[ProjectOut]:
    if not projects:
        return []
    rows = db.execute(
        select(
            Issue.project_id,
            func.count(),
            func.sum(case((Issue.status != IssueStatus.DONE, 1), else_=0)),
        )
        .where(Issue.project_id.in_([p.id for p in projects]))
        .group_by(Issue.project_id)
    ).all()
    counts = {pid: (total, open_ or 0) for pid, total, open_ in rows}
    result = []
    for project in projects:
        total, open_ = counts.get(project.id, (0, 0))
        out = ProjectOut.model_validate(project)
        out.total_issues, out.open_issues = total, open_
        result.append(out)
    return result


@router.get("", response_model=list[ProjectOut])
def list_projects(db: DbSession, user: CurrentUser) -> list[ProjectOut]:
    query = select(Project).order_by(Project.name)
    if not user.is_admin:
        query = query.join(ProjectMember).where(ProjectMember.user_id == user.id)
    return _with_counts(db, list(db.scalars(query).unique()))


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreate, db: DbSession, user: CurrentUser) -> ProjectOut:
    if db.scalar(select(Project).where(Project.key == data.key)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Project key {data.key} is taken"
        )
    project = Project(**data.model_dump(), owner_id=user.id)
    project.members.append(ProjectMember(user_id=user.id, role=ProjectRole.OWNER))
    db.add(project)
    db.commit()
    db.refresh(project)
    return _with_counts(db, [project])[0]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project: MemberProject, db: DbSession) -> ProjectOut:
    return _with_counts(db, [project])[0]


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(data: ProjectUpdate, project: OwnedProject, db: DbSession) -> ProjectOut:
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _with_counts(db, [project])[0]


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project: OwnedProject, db: DbSession) -> Response:
    db.delete(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/members", response_model=list[MemberOut])
def list_members(project: MemberProject, db: DbSession) -> list[ProjectMember]:
    return list(
        db.scalars(
            select(ProjectMember)
            .join(User)
            .where(ProjectMember.project_id == project.id)
            .order_by(User.full_name)
        )
    )


@router.post("/{project_id}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def add_member(data: MemberAdd, project: OwnedProject, db: DbSession) -> ProjectMember:
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No user with that email")
    if get_membership(db, project.id, user.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already a member")
    member = ProjectMember(project_id=project.id, user_id=user.id, role=data.role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(user_id: int, project: OwnedProject, db: DbSession) -> Response:
    if user_id == project.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the project owner"
        )
    member = get_membership(db, project.id, user_id)
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not a member")
    db.delete(member)
    # Unassign their open issues so nothing points at a non-member
    for issue in db.scalars(
        select(Issue).where(Issue.project_id == project.id, Issue.assignee_id == user_id)
    ):
        issue.assignee_id = None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/stats", response_model=ProjectStats)
def get_stats(project: MemberProject, db: DbSession) -> ProjectStats:
    return project_stats(db, project.id)
