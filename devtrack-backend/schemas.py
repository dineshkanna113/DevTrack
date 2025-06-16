from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str

class IssueCreate(BaseModel):
    title: str
    description: str

class IssueOut(BaseModel):
    id: int
    title: str
    description: str
    status: str

    class Config:
        from_attributes = True  # replaces deprecated orm_mode
