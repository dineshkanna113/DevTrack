import math
from datetime import date, datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    computed_field,
)

from app.models import IssuePriority, IssueStatus, IssueType, ProjectRole, UserRole


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth & users -----------------------------------------------------------

Password = Annotated[str, Field(min_length=8, max_length=72)]


class UserCreate(BaseModel):
    email: EmailStr
    full_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    password: Password


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105


class UserBrief(ORMModel):
    id: int
    email: EmailStr
    full_name: str


class UserOut(UserBrief):
    role: UserRole
    created_at: datetime


# --- Projects ---------------------------------------------------------------

ProjectKey = Annotated[
    str,
    # Normalize before validating: the pattern check runs ahead of `to_upper`.
    BeforeValidator(lambda v: v.strip().upper() if isinstance(v, str) else v),
    StringConstraints(pattern=r"^[A-Z][A-Z0-9]{1,9}$"),
]


class ProjectCreate(BaseModel):
    key: ProjectKey
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: str = ""


class ProjectUpdate(BaseModel):
    name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
        | None
    ) = None
    description: str | None = None


class ProjectOut(ORMModel):
    id: int
    key: str
    name: str
    description: str
    owner: UserBrief
    created_at: datetime
    open_issues: int = 0
    total_issues: int = 0


class MemberAdd(BaseModel):
    email: EmailStr
    role: ProjectRole = ProjectRole.MEMBER


class MemberOut(ORMModel):
    user: UserBrief
    role: ProjectRole
    joined_at: datetime


# --- Issues -----------------------------------------------------------------

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]


class IssueCreate(BaseModel):
    title: Title
    description: str = ""
    priority: IssuePriority = IssuePriority.MEDIUM
    type: IssueType = IssueType.TASK
    assignee_id: int | None = None
    due_date: date | None = None


class IssueUpdate(BaseModel):
    title: Title | None = None
    description: str | None = None
    status: IssueStatus | None = None
    priority: IssuePriority | None = None
    type: IssueType | None = None
    assignee_id: int | None = None
    due_date: date | None = None


class IssueOut(ORMModel):
    id: int
    key: str
    number: int
    project_id: int
    title: str
    description: str
    status: IssueStatus
    priority: IssuePriority
    type: IssueType
    reporter: UserBrief | None
    assignee: UserBrief | None
    due_date: date | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class IssuePage(BaseModel):
    items: list[IssueOut]
    total: int
    page: int
    page_size: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def pages(self) -> int:
        return math.ceil(self.total / self.page_size) if self.total else 0


class CommentCreate(BaseModel):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class CommentOut(ORMModel):
    id: int
    issue_id: int
    author: UserBrief | None
    body: str
    created_at: datetime


class ActivityOut(ORMModel):
    id: int
    actor: UserBrief | None
    action: str
    field: str | None
    old_value: str | None
    new_value: str | None
    created_at: datetime


# --- Stats ------------------------------------------------------------------


class DailyCount(BaseModel):
    date: date
    created: int
    resolved: int


class AssigneeCount(BaseModel):
    user: UserBrief | None
    count: int


class ProjectStats(BaseModel):
    total: int
    open: int
    done: int
    overdue: int
    by_status: dict[IssueStatus, int]
    by_priority: dict[IssuePriority, int]
    by_type: dict[IssueType, int]
    open_by_assignee: list[AssigneeCount]
    daily: list[DailyCount]


# --- AI ---------------------------------------------------------------------


class TriageRequest(BaseModel):
    title: Title
    description: str = Field(default="", max_length=10_000)


class DuplicateCandidate(BaseModel):
    id: int
    key: str
    title: str


class TriageResponse(BaseModel):
    type: IssueType
    priority: IssuePriority
    suggested_title: str
    summary: str
    reasoning: str
    duplicates: list[DuplicateCandidate]


class HealthOut(BaseModel):
    status: str
    database: str
    ai_enabled: bool
    version: str
