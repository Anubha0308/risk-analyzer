from fastapi import FastAPI, HTTPException, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from starlette.middleware.sessions import SessionMiddleware
import os

from database import users_collection,user_info_collection, user_stocks_info_collection
from auth_utils import hash_password, verify_password, get_current_user
from jwt_utils import create_access_token
from core.rate_limiter import setup_rate_limiter, limiter
from core.cooldown_logic import check_locked, record_failure, reset_attempts

from fastapi import Request
from fastapi.responses import RedirectResponse
from auth.google_auth import oauth

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
env = os.getenv("ENV", "development").lower()


def _env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


cookie_secure = _env_bool("COOKIE_SECURE", env == "production")
cookie_samesite = os.getenv("COOKIE_SAMESITE", "none" if cookie_secure else "lax").lower()

# Allow comma-separated origins via env for prod + local development.
cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", frontend_url).split(",")
    if origin.strip()
]

app = FastAPI()

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", "some-random-secret-key"),
    same_site=cookie_samesite,
    https_only=cookie_secure,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_rate_limiter(app)

class AuthRequest(BaseModel):
    email: EmailStr
    password: str

# ---------------- REGISTER ----------------

@app.post("/register")
@limiter.limit("5/minute")
def register(request: Request, data: AuthRequest, response: Response):
    # Check if user already exists before inserting
    if users_collection.find_one({"email": data.email}):
        raise HTTPException(status_code=409, detail="User already exists, try logging in")

    users_collection.insert_one({
        "email": data.email,
        "hashed_password": hash_password(data.password),
        "auth_provider": "manual"
    })
    user_info_collection.insert_one({
        "email":data.email,
        "watchlist":[],
        "recently_viewed":[],#upto 6 stocks
        "full_name":""
    })
    user_stocks_info_collection.insert_one({
        "email":data.email,
        "stocks": [] #list of stocks like key value pairs
    })
    token = create_access_token(data.email)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure,
        max_age=3600
    )

    return {"message": "Registered & logged in", "status": "success"}

# ---------------- LOGIN ----------------


@app.post("/login")
@limiter.limit("10/minute")
def login(request: Request, data: AuthRequest, response: Response):
    
    locked, remaining = check_locked(data.email)

    if locked:
        raise HTTPException(
            status_code=403,
            detail=f"Account locked. Try again in {remaining} seconds."
        )

    user = users_collection.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="User does not exist, try register")
    
    if user.get("hashed_password") is None:
        raise HTTPException(
            status_code=400,
            detail="This account uses Google login"
        )
    
    if not verify_password(data.password, user["hashed_password"]):
        record_failure(data.email)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    reset_attempts(data.email)

    token = create_access_token(data.email)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure,
        max_age=3600
    )

    return {"message": "Login successful", "status": "success"}

#-----------------GOOGLE AUTH-----------------

@app.get("/auth/google/login")
async def google_login(request: Request):
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI") or f"{backend_url}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri, state="login")

@app.get("/auth/google/callback")
async def google_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")

    if not user_info:
        return RedirectResponse(f"{frontend_url}/auth-error?type=google")

    email = user_info["email"]
    intent = request.query_params.get("state")
    user = users_collection.find_one({"email": email})

    if intent == "login" and not user:
        return RedirectResponse(f"{frontend_url}/auth-error?type=not_registered")

    if intent == "signup" and user:
        return RedirectResponse(f"{frontend_url}/auth-error?type=already_exists")

    # success
    if intent == "signup":
        users_collection.insert_one({
            "email": email,
            "hashed_password": None,
            "auth_provider": "google"
        })
        user_info_collection.insert_one({
            "email": email,
            "watchlist": [],
            "recently_viewed": [],
            "full_name": ""
        })
        user_stocks_info_collection.insert_one({
            "email": email,
            "stocks": [] 
        })
        

    # Create JWT
    jwt_token = create_access_token(email)

    # Create redirect response and set cookie on it(idhar par issue aa raha tha kyuki respponse ke saath cookie send nahi ho rahi thi 
    #kyuki baad me new redirect response send ho raha tha actual jisme cookie thi wo wala response nahi)
    redirect_response = RedirectResponse(url=f"{frontend_url}/")
    redirect_response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure,
        max_age=3600
    )
    
    return redirect_response

@app.get("/auth/google/signup")
async def google_signup(request: Request):
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI") or f"{backend_url}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri, state="signup")

# ---------------- PROTECTED ----------------
@app.get("/me")
def me(user: str = Depends(get_current_user)): 
    return {"email": user}

# ---------------- LOGOUT ----------------
@app.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    return {"message": "Logged out"}
# ---------------- PREDICTION ----------------
from routes.prediction import router as prediction_router
app.include_router(prediction_router)
# ---------------- MARKET ----------------
from routes.market import router as market_router
app.include_router(market_router)
# ---------------- PROFILE ----------------
from routes.profile import router as profile_router
app.include_router(profile_router)