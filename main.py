from fastapi import FastAPI
from database import Base, engine
from routes import auth

# Initialize app
app = FastAPI(title="DevTrack API")

# Create DB tables
Base.metadata.create_all(bind=engine)

# Register routes
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
