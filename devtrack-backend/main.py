from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from database import Base, engine
from routes import auth, issues
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="DevTrack API")


Base.metadata.create_all(bind=engine)

#  PROPER CORS MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://devtrack-frontend-sigma.vercel.app",
        "https://devtrack-frontend-cqw0lvls2-dinesh-kannas-projects.vercel.app/"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

#  ROUTES
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(issues.router, tags=["Issues"])

#  Root endpoint
@app.get("/")
def root():
    return {"message": "DevTrack backend live"}

#  CORS preflight handler for register
@app.options("/auth/register")
def options_register():
    return Response(status_code=200)

#  CORS preflight handler for login
@app.options("/auth/login")
def options_login():
    return Response(status_code=200)
