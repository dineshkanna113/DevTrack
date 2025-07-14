from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str

class IssueBase(BaseModel):
    title: str
    description: str
    status: str = "open"           # "open" or "closed"
    label: str = "task"            # e.g., bug, feature, task
    assigned_to: str = "unassigned"

class IssueCreate(IssueBase):
    pass

class IssueOut(IssueBase):
    id: int
    owner_id: Optional[int]                 # Include the user who created it
    model_config = ConfigDict(from_attributes=True)
