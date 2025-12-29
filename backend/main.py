from fastapi import FastAPI, HTTPException, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from starlette.middleware.sessions import SessionMiddleware
import os

from database import users_collection,user_info_collection  
from auth_utils import hash_password, verify_password, get_current_user
from jwt_utils import create_access_token

from fastapi import Request
from fastapi.responses import RedirectResponse
from auth.google_auth import oauth


app = FastAPI()

app.add_middleware(
    SessionMiddleware,
    secret_key="some-random-secret-key",
    same_site="lax"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuthRequest(BaseModel):
    email: EmailStr
    password: str

# ---------------- REGISTER ----------------
@app.post("/register")
def register(data: AuthRequest, response: Response):
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
    token = create_access_token(data.email)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=3600
    )

    return {"message": "Registered & logged in", "status": "success"}

# ---------------- LOGIN ----------------
@app.post("/login")
def login(data: AuthRequest, response: Response):
    user = users_collection.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="User does not exist, try register")
    
    if user.get("hashed_password") is None:
        raise HTTPException(
            status_code=400,
            detail="This account uses Google login"
        )

    if not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = create_access_token(data.email)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=3600
    )

    return {"message": "Login successful", "status": "success"}

#-----------------GOOGLE AUTH-----------------

@app.get("/auth/google/login")
async def google_login(request: Request):
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/google/callback")
async def google_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")

    if not user_info:
        raise HTTPException(status_code=400, detail="Google auth failed")

    email = user_info["email"]

    user = users_collection.find_one({"email": email})

    # If user does not exist, create new user (signup logic)
    if not user:
        
        users_collection.insert_one({
            "email": email,
            "hashed_password": None,
            "auth_provider": "google"
        })
        user_info_collection.insert_one({
        "email":email,
        "watchlist":[],
        "recently_viewed":[],#upto 6 stocks
        "full_name":""
        })
        
        message = "Registered & logged in"
    else:
        message = "Login successful"

    # Create JWT
    jwt_token = create_access_token(email)

    # Create redirect response and set cookie on it(idhar par issue aa raha tha kyuki respponse ke saath cookie send nahi ho rahi thi 
    #kyuki baad me new redirect response send ho raha tha actual jisme cookie thi wo wala response nahi)
    redirect_response = RedirectResponse(url="http://localhost:5173/")
    redirect_response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=3600
    )

    return redirect_response

@app.get("/auth/google/signup")
async def google_signup(request: Request):
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    return await oauth.google.authorize_redirect(request, redirect_uri)

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
        samesite="lax",
        secure=False
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