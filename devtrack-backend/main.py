from fastapi import FastAPI
from database import Base, engine
from routes import auth, issues
from fastapi.middleware.cors import CORSMiddleware

# Initialize app
app = FastAPI(title="DevTrack API")

# Create database tables
Base.metadata.create_all(bind=engine)

# Register routes
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(issues.router, tags=["Issues"])

# Allow frontend access via CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://devtrack-frontend-wine.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
