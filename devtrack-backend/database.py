from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get the DATABASE_URL from environment
POSTGRES_URL = os.getenv("DATABASE_URL")

if not POSTGRES_URL:
    raise ValueError("❌ DATABASE_URL is not set in environment variables.")

# ✅ Create SQLAlchemy engine
engine = create_engine(POSTGRES_URL)

# ✅ Create a configured session class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ✅ Declare a base class for models
Base = declarative_base()
