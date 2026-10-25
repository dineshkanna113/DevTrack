from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Issue, Project, ProjectMember, ProjectRole, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{get_settings().api_prefix}/auth/login")

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession, token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_id = decode_access_token(token)
    except jwt.PyJWTError:
        raise unauthorized from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_membership(db: Session, project_id: int, user_id: int) -> ProjectMember | None:
    return db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    )


def get_project_for_member(project_id: int, db: DbSession, user: CurrentUser) -> Project:
    """Load a project the current user can see. Non-members get 404 so ids don't leak."""
    project = db.get(Project, project_id)
    if project is None or (not user.is_admin and get_membership(db, project_id, user.id) is None):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


MemberProject = Annotated[Project, Depends(get_project_for_member)]


def require_project_owner(project: MemberProject, db: DbSession, user: CurrentUser) -> Project:
    if user.is_admin:
        return project
    membership = get_membership(db, project.id, user.id)
    if membership is None or membership.role != ProjectRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only project owners can do this"
        )
    return project


OwnedProject = Annotated[Project, Depends(require_project_owner)]


def get_issue_for_member(issue_id: int, db: DbSession, user: CurrentUser) -> Issue:
    issue = db.get(Issue, issue_id)
    if issue is None or (
        not user.is_admin and get_membership(db, issue.project_id, user.id) is None
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    return issue


MemberIssue = Annotated[Issue, Depends(get_issue_for_member)]
