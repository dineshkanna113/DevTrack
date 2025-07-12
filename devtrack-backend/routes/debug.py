from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db

router = APIRouter()

@router.post("/admin/add-owner-id-column")
def add_owner_id_column(db: Session = Depends(get_db)):
    try:
        db.execute("ALTER TABLE issues ADD COLUMN owner_id INTEGER REFERENCES users(id);")
        db.commit()
        return {"success": True, "message": "✅ owner_id column added"}
    except Exception as e:
        return {"error": str(e)}
