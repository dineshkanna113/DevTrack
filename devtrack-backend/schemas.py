from pydantic import BaseModel, EmailStr, ConfigDict

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
    status: str = "open"  # ✅ fix here
    label: str = "task"
    assigned_to: str = ""

class IssueCreate(IssueBase):
    pass

class IssueOut(IssueBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
