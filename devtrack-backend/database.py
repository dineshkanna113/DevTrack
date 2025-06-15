from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Load environment variables (optional)
from dotenv import load_dotenv
load_dotenv()

# Default to local SQLite; override with environment variable if deploying
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./devtrack.db")

# Required for SQLite (skip this if using PostgreSQL)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base model for all ORM classes
Base = declarative_base()
