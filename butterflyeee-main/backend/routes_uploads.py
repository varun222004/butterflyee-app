"""Upload + download routes for media (voice notes, photos)."""
import os
import uuid
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, Response
from bson import ObjectId

from auth import get_current_user, decode_token
from db import get_db
from storage import put_object, get_object, app_name
from utils import now_iso

logger = logging.getLogger(__name__)
router = APIRouter(tags=["uploads"])


ALLOWED_MIME_PREFIXES = ("image/", "audio/", "video/")
MAX_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("/uploads")
async def upload_file(
    file: UploadFile = File(...),
    room_key: str = "general",
    user: dict = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith(ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=400, detail="That file type isn't supported here.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File is too large (max 25 MB).")
    db = get_db()
    pair = await db.pairs.find_one({"members": user["id"]})
    pair_id = str(pair["_id"]) if pair else "solo"
    ext = "bin"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
    path = f"{app_name()}/{pair_id}/{room_key}/{uuid.uuid4().hex}.{ext}"
    try:
        result = put_object(path, data, file.content_type)
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=502, detail="Could not store the file. Please try again.")
    canonical_path = result["path"]
    await db.files.insert_one({
        "storage_path": canonical_path,
        "owner_user_id": user["id"],
        "pair_id": pair_id,
        "room_key": room_key,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now_iso(),
    })
    return {
        "path": canonical_path,
        "url": f"/api/files/{canonical_path}",
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
    }


@router.get("/files/{path:path}")
async def serve_file(path: str, token: str | None = Query(None)):
    """Public-by-pair download endpoint. Auth via cookie (default) or ?token=<jwt> for <img>/<audio> tags."""
    # If token query is provided, validate it (cookies are also automatically read by browsers).
    if token:
        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Invalid token type")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
    db = get_db()
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, content_type = get_object(path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        logger.error(f"Storage fetch failed for {path}: {e}")
        raise HTTPException(status_code=502, detail="Could not load the file.")
    return Response(content=data, media_type=record.get("content_type", content_type))
