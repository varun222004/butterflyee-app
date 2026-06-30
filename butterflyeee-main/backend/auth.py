"""Authentication: bcrypt hashing, JWT tokens, current-user dependency."""
import os
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Request, status
from bson import ObjectId
from db import get_db


def _algo() -> str:
    return os.environ.get("JWT_ALGORITHM", "HS256")


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def _access_minutes() -> int:
    return int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


def _refresh_days() -> int:
    return int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "14"))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_access_minutes()),
    }
    return jwt.encode(payload, _secret(), algorithm=_algo())


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=_refresh_days()),
    }
    return jwt.encode(payload, _secret(), algorithm=_algo())


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=[_algo()])


def set_auth_cookies(response, access: str, refresh: str):
    response.set_cookie(
        "access_token", access, httponly=True, secure=True, samesite="none",
        max_age=_access_minutes() * 60, path="/",
    )
    response.set_cookie(
        "refresh_token", refresh, httponly=True, secure=True, samesite="none",
        max_age=_refresh_days() * 24 * 3600, path="/",
    )


def clear_auth_cookies(response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        db = get_db()
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user.pop("_id"))
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
