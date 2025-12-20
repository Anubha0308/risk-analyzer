from fastapi import FastAPI, HTTPException, Response, Depends, Cookie
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError
import os

from database import users_collection
from auth_utils import hash_password, verify_password
from jwt_utils import create_access_token


app = FastAPI()

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

# ---------------- AUTH HELPERS ----------------
def get_current_user(access_token: str = Cookie(None)):
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        secret = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
        algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        payload = jwt.decode(
            access_token,
            secret,
            algorithms=[algorithm]
        )
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------------- REGISTER ----------------
@app.post("/register")
def register(data: AuthRequest, response: Response):
    # Check if user already exists before inserting
    if users_collection.find_one({"email": data.email}):
        raise HTTPException(status_code=409, detail="User already exists, try logging in")

    users_collection.insert_one({
        "email": data.email,
        "hashed_password": hash_password(data.password)
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

# ---------------- PROTECTED ----------------
@app.get("/me")
def me(user: str = Depends(get_current_user)):
    return {"email": user}

# ---------------- LOGOUT ----------------
@app.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}
# ---------------- PREDICTION ----------------
from routes.prediction import router as prediction_router
app.include_router(prediction_router)
