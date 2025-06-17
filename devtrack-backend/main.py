from fastapi import FastAPI
from fastapi.responses import Response
from database import Base, engine
from fastapi import Response
from routes import auth, issues
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

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
        "https://devtrack-frontend-sigma.vercel.app/"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from fastapi.responses import Response

@app.get("/")
def root():
    return {"message": "Backend live"}
@app.options("/auth/register")
def preflight_register():
    return Response(status_code=200)

@app.options("/auth/login")
def preflight_login():
    return Response(status_code=200)
