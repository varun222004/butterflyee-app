"""Entries (room content) routes. Implements the buddy-pair editing rules:
- Personal rooms: you can only edit entries authored FOR your buddy
  (target_user_id = buddy, author_user_id = you).
- Shared rooms (world="shared"): either pair member can create/edit/delete.
- Reading: you see entries where target_user_id = you (My World) OR
  authored by you (Buddy's World preview) OR shared.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from datetime import datetime, timezone

from auth import get_current_user
from db import get_db
from models import EntryCreate, EntryUpdate
from utils import now_iso


router = APIRouter(prefix="/rooms", tags=["entries"])


PERSONAL_ROOMS = {
    "appreciation", "letters", "memories", "butterfly_lounge", "good_night",
    "dog_cafe", "doctor_corner", "achievements", "surprises", "secret_room",
}
SHARED_ROOMS = {"shared_journal", "bucket_list"}
ALL_ROOMS = PERSONAL_ROOMS | SHARED_ROOMS


async def _get_pair_or_404(db, user_id: str) -> dict:
    pair = await db.pairs.find_one({"members": user_id})
    if not pair:
        raise HTTPException(status_code=400, detail="Connect with a Butterfly buddy first.")
    return pair


def _other_member(pair: dict, user_id: str) -> str:
    return [m for m in pair["members"] if m != user_id][0]


async def _hydrate(db, entry: dict) -> dict:
    author = await db.users.find_one({"_id": ObjectId(entry["author_user_id"])})
    return {
        "id": str(entry["_id"]),
        "pair_id": entry["pair_id"],
        "room_key": entry["room_key"],
        "world": entry["world"],
        "target_user_id": entry.get("target_user_id"),
        "author_user_id": entry["author_user_id"],
        "author": {
            "id": str(author["_id"]),
            "display_name": author.get("display_name"),
            "handle": author.get("handle"),
            "buddy_id": author.get("buddy_id"),
        } if author else None,
        "title": entry.get("title", "") or "",
        "body": entry.get("body", "") or "",
        "media_path": entry.get("media_path"),
        "metadata": entry.get("metadata", {}) or {},
        "status": entry.get("status", "published"),
        "publish_at": entry.get("publish_at"),
        "created_at": entry["created_at"],
        "updated_at": entry.get("updated_at", entry["created_at"]),
    }


def _is_published_now(entry: dict) -> bool:
    if entry.get("status") in ("draft", "archived"):
        return False
    if entry.get("status") == "scheduled":
        publish_at = entry.get("publish_at")
        if not publish_at:
            return False
        try:
            dt = datetime.fromisoformat(publish_at.replace("Z", "+00:00"))
            return dt <= datetime.now(timezone.utc)
        except Exception:
            return False
    return entry.get("status") == "published"


# ---------------- LIST ----------------
@router.get("/{room_key}/entries")
async def list_entries(
    room_key: str,
    view: str = Query("mine", description="mine | buddy | shared"),
    include_unpublished: bool = Query(False),
    user: dict = Depends(get_current_user),
):
    if room_key not in ALL_ROOMS:
        raise HTTPException(status_code=404, detail="Unknown room")
    db = get_db()
    pair = await _get_pair_or_404(db, user["id"])
    pair_id = str(pair["_id"])

    is_shared = room_key in SHARED_ROOMS
    if is_shared:
        query = {"pair_id": pair_id, "room_key": room_key, "world": "shared"}
    elif view == "mine":
        # Content FOR me, authored by buddy
        query = {
            "pair_id": pair_id, "room_key": room_key, "world": "personal",
            "target_user_id": user["id"],
        }
    elif view == "buddy":
        # Content I authored FOR my buddy (Studio + Preview)
        buddy_id = _other_member(pair, user["id"])
        query = {
            "pair_id": pair_id, "room_key": room_key, "world": "personal",
            "target_user_id": buddy_id, "author_user_id": user["id"],
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid view")

    cursor = db.entries.find(query).sort("created_at", -1)
    items = await cursor.to_list(1000)
    hydrated = [await _hydrate(db, e) for e in items]
    if not include_unpublished and (view == "mine" or is_shared):
        hydrated = [e for e in hydrated if _is_published_now(e)]
    return {"entries": hydrated}


# ---------------- CREATE ----------------
@router.post("/{room_key}/entries")
async def create_entry(
    room_key: str,
    payload: EntryCreate,
    user: dict = Depends(get_current_user),
):
    if room_key not in ALL_ROOMS:
        raise HTTPException(status_code=404, detail="Unknown room")
    if payload.room_key != room_key:
        raise HTTPException(status_code=400, detail="Room key mismatch")
    db = get_db()
    pair = await _get_pair_or_404(db, user["id"])
    pair_id = str(pair["_id"])
    is_shared = room_key in SHARED_ROOMS
    if is_shared:
        target_user_id = None
        world = "shared"
    else:
        target_user_id = _other_member(pair, user["id"])
        world = "personal"
    now = now_iso()
    status_val = payload.status
    if payload.publish_at and status_val == "published":
        try:
            dt = datetime.fromisoformat(payload.publish_at.replace("Z", "+00:00"))
            if dt > datetime.now(timezone.utc):
                status_val = "scheduled"
        except Exception:
            pass
    doc = {
        "pair_id": pair_id,
        "room_key": room_key,
        "world": world,
        "target_user_id": target_user_id,
        "author_user_id": user["id"],
        "title": (payload.title or "").strip(),
        "body": (payload.body or "").strip(),
        "media_path": payload.media_path,
        "metadata": payload.metadata or {},
        "status": status_val,
        "publish_at": payload.publish_at,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.entries.insert_one(doc)
    doc["_id"] = result.inserted_id
    return await _hydrate(db, doc)


# ---------------- UPDATE ----------------
@router.put("/{room_key}/entries/{entry_id}")
async def update_entry(
    room_key: str,
    entry_id: str,
    payload: EntryUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    pair = await _get_pair_or_404(db, user["id"])
    entry = await db.entries.find_one({"_id": ObjectId(entry_id), "pair_id": str(pair["_id"]), "room_key": room_key})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    is_shared = entry.get("world") == "shared"
    if not is_shared and entry["author_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit content you wrote for your buddy.")
    update: dict = {"updated_at": now_iso()}
    for field in ("title", "body", "media_path", "metadata", "status", "publish_at"):
        v = getattr(payload, field)
        if v is not None:
            update[field] = v
    await db.entries.update_one({"_id": ObjectId(entry_id)}, {"$set": update})
    fresh = await db.entries.find_one({"_id": ObjectId(entry_id)})
    return await _hydrate(db, fresh)


# ---------------- DELETE ----------------
@router.delete("/{room_key}/entries/{entry_id}")
async def delete_entry(
    room_key: str,
    entry_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    pair = await _get_pair_or_404(db, user["id"])
    entry = await db.entries.find_one({"_id": ObjectId(entry_id), "pair_id": str(pair["_id"]), "room_key": room_key})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    is_shared = entry.get("world") == "shared"
    if not is_shared and entry["author_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete content you wrote for your buddy.")
    await db.entries.delete_one({"_id": ObjectId(entry_id)})
    return {"ok": True}


# ---------------- Counts (small summary for index page / world dots) ----------------
@router.get("/summary")
async def rooms_summary(user: dict = Depends(get_current_user)):
    db = get_db()
    pair = await db.pairs.find_one({"members": user["id"]})
    if not pair:
        return {"counts": {}}
    pair_id = str(pair["_id"])
    buddy_id = _other_member(pair, user["id"])
    pipeline_mine = [
        {"$match": {"pair_id": pair_id, "world": "personal", "target_user_id": user["id"]}},
        {"$group": {"_id": "$room_key", "count": {"$sum": 1}}},
    ]
    pipeline_buddy = [
        {"$match": {"pair_id": pair_id, "world": "personal", "target_user_id": buddy_id, "author_user_id": user["id"]}},
        {"$group": {"_id": "$room_key", "count": {"$sum": 1}}},
    ]
    pipeline_shared = [
        {"$match": {"pair_id": pair_id, "world": "shared"}},
        {"$group": {"_id": "$room_key", "count": {"$sum": 1}}},
    ]
    mine = {r["_id"]: r["count"] async for r in db.entries.aggregate(pipeline_mine)}
    buddy = {r["_id"]: r["count"] async for r in db.entries.aggregate(pipeline_buddy)}
    shared = {r["_id"]: r["count"] async for r in db.entries.aggregate(pipeline_shared)}
    return {"counts": {"mine": mine, "buddy": buddy, "shared": shared}}
