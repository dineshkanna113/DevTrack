from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from routes import auth, issues
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="DevTrack API")

# Create database tables
Base.metadata.create_all(bind=engine)

# Enable CORS for frontend deployment and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://devtrack-frontend-sigma.vercel.app",
        "https://devtrack-frontend-cqw0lvls2-dinesh-kannas-projects.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Include route files
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(issues.router, tags=["Issues"])

# Root endpoint to verify deployment
@app.get("/")
def root():
    return {"message": "DevTrack backend live"}
