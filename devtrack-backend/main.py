from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from database import Base, engine
from routes import auth, issues
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="DevTrack API")

Base.metadata.create_all(bind=engine)

# ✅ PROPER CORS MIDDLEWARE SETUP
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://devtrack-frontend-sigma.vercel.app",
        "https://devtrack-frontend-cqw0lvls2-dinesh-kannas-projects.vercel.app"  # no trailing slash
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ✅ ROUTES
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(issues.router, tags=["Issues"])

# ✅ Root test endpoint
@app.get("/")
def root():
    return {"message": "DevTrack backend live"}
