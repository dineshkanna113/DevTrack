from pydantic import BaseModel, EmailStr

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
    status: bool = True
    label: str = "task"  # 🆕
    assigned_to: str = "unassigned"  # 🆕

class IssueCreate(IssueBase):
    pass

class IssueOut(IssueBase):
    id: int

    class Config:
        from_attributes = True

