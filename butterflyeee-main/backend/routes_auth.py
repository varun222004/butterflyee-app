"""Auth routes: register, login, logout, me, refresh."""
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from bson import ObjectId
from datetime import datetime, timezone

from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies,
    get_current_user, decode_token,
)
from db import get_db
from models import RegisterRequest, LoginRequest, UserPublic
from utils import generate_buddy_id, now_iso


router = APIRouter(prefix="/auth", tags=["auth"])


def _user_to_public(user: dict) -> dict:
    return {
        "id": str(user.get("_id", user.get("id"))),
        "email": user["email"],
        "buddy_id": user["buddy_id"],
        "handle": user.get("handle"),
        "display_name": user.get("display_name"),
        "created_at": user["created_at"],
        "onboarded": bool(user.get("onboarded", False)),
    }


async def _unique_buddy_id(db) -> str:
    for _ in range(8):
        candidate = generate_buddy_id()
        if not await db.users.find_one({"buddy_id": candidate}):
            return candidate
    raise HTTPException(status_code=500, detail="Could not generate buddy id")


@router.post("/register", response_model=UserPublic)
async def register(payload: RegisterRequest, response: Response):
    db = get_db()
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    buddy_id = await _unique_buddy_id(db)
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "buddy_id": buddy_id,
        "handle": None,
        "display_name": (payload.display_name or "").strip() or None,
        "created_at": now_iso(),
        "onboarded": False,
    }
    result = await db.users.insert_one(doc)
    uid = str(result.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    doc["_id"] = result.inserted_id
    return _user_to_public(doc)


@router.post("/login", response_model=UserPublic)
async def login(payload: LoginRequest, response: Response):
    db = get_db()
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return _user_to_public(user)


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return _user_to_public(user)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        uid = payload["sub"]
        db = get_db()
        user = await db.users.find_one({"_id": ObjectId(uid)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        set_auth_cookies(response, create_access_token(uid, user["email"]), create_refresh_token(uid))
        return {"ok": True}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
