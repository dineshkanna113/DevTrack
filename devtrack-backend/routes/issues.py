from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import Issue
from database import SessionLocal
from schemas import IssueCreate, IssueOut

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/issues", response_model=IssueOut)
def create_issue(issue: IssueCreate, db: Session = Depends(get_db)):
    new_issue = Issue(**issue.dict())
    db.add(new_issue)
    db.commit()
    db.refresh(new_issue)
    return new_issue

@router.get("/issues", response_model=list[IssueOut])
def list_issues(db: Session = Depends(get_db)):
    return db.query(Issue).all()

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
