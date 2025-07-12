from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="open", nullable=False)  # "open" or "closed"
    label = Column(String, default="task", nullable=False)   # e.g., bug, feature
    assigned_to = Column(String, default="unassigned", nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"))