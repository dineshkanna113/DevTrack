from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import Issue, User
from database import SessionLocal
from schemas import IssueCreate, IssueOut
from typing import Optional
from routes.auth import get_current_user
from fastapi.responses import JSONResponse

router = APIRouter()

# ✅ Reusable DB dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ✅ GET issues (filtered, paginated)
@router.get("/issues")
def get_issues(
    page: int = 1,
    limit: int = 5,
    status: Optional[str] = None,
    label: Optional[str] = None,
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * limit
    query = db.query(Issue)

    # Optional filters
    if status in {"open", "closed"}:
        query = query.filter(Issue.status == status)
    if label:
        query = query.filter(Issue.label == label)
    if assigned_to:
        query = query.filter(Issue.assigned_to == assigned_to)

    total = query.count()
    total_pages = (total + limit - 1) // limit
    issues = query.offset(offset).limit(limit).all()

    return JSONResponse(content={
        "items": [IssueOut.model_validate(issue) for issue in issues],
        "total_pages": total_pages
    })

# ✅ POST create new issue
@router.post("/issues", response_model=IssueOut)
def create_issue(issue: IssueCreate, db: Session = Depends(get_db), current_user: int = Depends(get_current_user)):
    new_issue = Issue(
        title=issue.title,
        description=issue.description,
        status="open",
        label=issue.label,
        assigned_to=issue.assigned_to,
        # Temporarily omit or hardcode this:
        # owner_id=current_user.id  
    )
    db.add(new_issue)
    db.commit()
    db.refresh(new_issue)
    return new_issue

# ✅ DELETE an issue
@router.post("/issues", response_model=IssueOut)
def create_issue(issue: IssueCreate, db: Session = Depends(get_db)):
    new_issue = Issue(
        title=issue.title,
        description=issue.description,
        status="open",
        label=issue.label,
        assigned_to=issue.assigned_to
    )
    db.add(new_issue)
    db.commit()
    db.refresh(new_issue)
    return new_issue

# ✅ PATCH: toggle issue open/closed
@router.patch("/issues/{issue_id}/close")
def toggle_issue_status(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue.status = "closed" if issue.status == "open" else "open"
    db.commit()
    db.refresh(issue)
    return {"message": f"Issue status updated to {issue.status}", "status": issue.status}
