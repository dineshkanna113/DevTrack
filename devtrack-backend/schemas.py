from pydantic import BaseModel, EmailStr,ConfigDict

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
    status: str = open
    label: str = "task"  # default
    assigned_to: str = ""  # default

class IssueCreate(IssueBase):
    pass

class IssueOut(IssueBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
