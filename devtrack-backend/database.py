from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# For loading .env in local dev
from dotenv import load_dotenv
load_dotenv()

# Use PostgreSQL connection from environment variable
POSTGRES_URL = os.getenv("DATABASE_URL")

# Create engine
engine = create_engine(POSTGRES_URL)

# Session and Base setup
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
