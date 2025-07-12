from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import Issue, User
from database import SessionLocal
from schemas import IssueCreate, IssueOut
from typing import List, Optional
from auth import get_current_user
from fastapi.responses import JSONResponse
from schemas import IssueOut


router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/issues")
def get_issues(
    page: int = 1,
    limit: int = 5,
    status: Optional[bool] = None,
    label: Optional[str] = None,
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_db),
    token_data: dict = Depends(get_current_user)  # ✅ this gives access to email
):
    print("User email:", token_data["email"])
    offset = (page - 1) * limit
    query = db.query(Issue)

    if status is not None:
        query = query.filter(Issue.status == status)
    if label:
        query = query.filter(Issue.label == label)
    if assigned_to:
        query = query.filter(Issue.assigned_to == assigned_to)

    total = query.count()
    issues = query.offset(offset).limit(limit).all()

    # Use Pydantic v2 model_validate with from_attributes=True
    return JSONResponse(content={
        "Issues": [IssueOut.model_validate(issue) for issue in issues],
        "total": total
    })

@router.delete("/issues/{issue_id}")
def delete_issue(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    db.delete(issue)
    db.commit()
    return {"message": "Issue deleted"}
@router.patch("/issues/{issue_id}/close")
def close_issue(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    issue.status = "closed" if issue.status == "open" else "open"
    db.commit()
    db.refresh(issue)
    return {"message": f"Issue marked as {issue.status}", "status": issue.status}

