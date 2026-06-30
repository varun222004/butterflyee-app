"""Profile + Buddy routes."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from auth import get_current_user
from db import get_db
from models import ProfileUpdate, BuddyRequestCreate
from utils import normalize_handle, is_valid_handle, sorted_pair_members, now_iso


logger = logging.getLogger(__name__)
router = APIRouter(tags=["buddy"])


# ----- Helpers -----
def _public_user(u: dict) -> dict:
    return {
        "id": str(u.get("_id", u.get("id"))),
        "buddy_id": u.get("buddy_id"),
        "handle": u.get("handle"),
        "display_name": u.get("display_name"),
    }


async def _find_user_by_identifier(db, identifier: str) -> dict | None:
    # Aggressively clean the input: trim, strip BOM/zero-width chars, normalize case.
    raw = (identifier or "").strip()
    # Remove invisible/zero-width chars that often hitchhike on pasted text.
    invisible = "\u200b\u200c\u200d\u2060\ufeff\u00a0"
    for ch in invisible:
        raw = raw.replace(ch, "")
    raw = raw.strip()
    if not raw:
        return None
    # Buddy ID lookup (case-insensitive store is always uppercase).
    upper = raw.upper()
    if upper.startswith("BTF-"):
        # Try exact then case-insensitive (defensive).
        u = await db.users.find_one({"buddy_id": upper})
        if u:
            return u
        return await db.users.find_one({"buddy_id": {"$regex": f"^{upper}$", "$options": "i"}})
    # Handle lookup.
    handle = normalize_handle(raw)
    if not handle:
        return None
    return await db.users.find_one({"handle": handle})


async def _get_pair_for_user(db, user_id: str) -> dict | None:
    return await db.pairs.find_one({"members": user_id})


# ----- Profile -----
@router.put("/profile/me")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    update: dict = {}
    if payload.display_name is not None:
        update["display_name"] = payload.display_name.strip() or None
    if payload.handle is not None:
        handle = normalize_handle(payload.handle)
        if handle == "":
            update["handle"] = None
        else:
            if not is_valid_handle(handle):
                raise HTTPException(status_code=400, detail="Handle must be 3–20 chars: a–z, 0–9, underscore.")
            existing = await db.users.find_one({"handle": handle})
            if existing and str(existing["_id"]) != user["id"]:
                raise HTTPException(status_code=400, detail="That handle is already taken.")
            update["handle"] = handle
    if update:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    fresh = await db.users.find_one({"_id": ObjectId(user["id"])})
    return {
        "id": str(fresh["_id"]),
        "email": fresh["email"],
        "buddy_id": fresh["buddy_id"],
        "handle": fresh.get("handle"),
        "display_name": fresh.get("display_name"),
        "created_at": fresh["created_at"],
        "onboarded": bool(fresh.get("onboarded", False)),
    }


@router.post("/profile/complete-onboarding")
async def complete_onboarding(user: dict = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"onboarded": True}})
    return {"ok": True}


# ----- Search -----
@router.get("/users/lookup")
async def lookup_user(q: str, user: dict = Depends(get_current_user)):
    db = get_db()
    found = await _find_user_by_identifier(db, q)
    if not found or str(found["_id"]) == user["id"]:
        return {"user": None}
    return {"user": _public_user(found)}


# ----- Buddy requests -----
@router.post("/buddies/request")
async def send_buddy_request(payload: BuddyRequestCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    target = await _find_user_by_identifier(db, payload.identifier)
    logger.info(
        "[buddy-request] from_user=%s (buddy_id=%s) lookup=%r -> found=%s",
        user["id"], user.get("buddy_id"), payload.identifier,
        (str(target.get("_id")) + " buddy_id=" + str(target.get("buddy_id"))) if target else None,
    )
    if not target:
        raise HTTPException(status_code=404, detail="No one with that handle or ID was found.")
    if str(target["_id"]) == user["id"]:
        raise HTTPException(status_code=400, detail="That looks like your own Butterfly ID — try theirs instead.")
    # Already paired anywhere?
    my_pair = await _get_pair_for_user(db, user["id"])
    if my_pair:
        raise HTTPException(status_code=400, detail="You already have a Butterfly buddy.")
    their_pair = await _get_pair_for_user(db, str(target["_id"]))
    if their_pair:
        raise HTTPException(status_code=400, detail="That person already has a buddy.")
    # Existing pending?
    existing = await db.buddy_requests.find_one({
        "$or": [
            {"from_user_id": user["id"], "to_user_id": str(target["_id"]), "status": "pending"},
            {"from_user_id": str(target["_id"]), "to_user_id": user["id"], "status": "pending"},
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="A request already exists between you two.")
    doc = {
        "from_user_id": user["id"],
        "to_user_id": str(target["_id"]),
        "status": "pending",
        "created_at": now_iso(),
    }
    result = await db.buddy_requests.insert_one(doc)
    return {"id": str(result.inserted_id), "status": "pending"}


@router.get("/buddies/requests")
async def list_requests(user: dict = Depends(get_current_user)):
    db = get_db()
    incoming = await db.buddy_requests.find({"to_user_id": user["id"], "status": "pending"}).to_list(50)
    outgoing = await db.buddy_requests.find({"from_user_id": user["id"], "status": "pending"}).to_list(50)

    async def hydrate(req, key):
        other_id = req[key]
        other = await db.users.find_one({"_id": ObjectId(other_id)})
        return {
            "id": str(req["_id"]),
            "status": req["status"],
            "created_at": req["created_at"],
            "user": _public_user(other) if other else None,
        }

    return {
        "incoming": [await hydrate(r, "from_user_id") for r in incoming],
        "outgoing": [await hydrate(r, "to_user_id") for r in outgoing],
    }


@router.post("/buddies/requests/{request_id}/accept")
async def accept_request(request_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    req = await db.buddy_requests.find_one({"_id": ObjectId(request_id)})
    if not req or req["to_user_id"] != user["id"] or req["status"] != "pending":
        raise HTTPException(status_code=404, detail="Request not found.")
    # Re-check no existing pair
    if await _get_pair_for_user(db, user["id"]) or await _get_pair_for_user(db, req["from_user_id"]):
        raise HTTPException(status_code=400, detail="One of you already has a buddy.")
    members = sorted_pair_members(user["id"], req["from_user_id"])
    pair_doc = {"members": members, "created_at": now_iso()}
    pair_result = await db.pairs.insert_one(pair_doc)
    await db.buddy_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "accepted", "pair_id": str(pair_result.inserted_id)}},
    )
    # Decline any other pending requests for both users
    await db.buddy_requests.update_many(
        {"_id": {"$ne": ObjectId(request_id)},
         "status": "pending",
         "$or": [
             {"from_user_id": {"$in": members}},
             {"to_user_id": {"$in": members}},
         ]},
        {"$set": {"status": "cancelled"}},
    )
    return {"ok": True, "pair_id": str(pair_result.inserted_id)}


@router.post("/buddies/requests/{request_id}/decline")
async def decline_request(request_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    req = await db.buddy_requests.find_one({"_id": ObjectId(request_id)})
    if not req or req["to_user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Request not found.")
    await db.buddy_requests.update_one(
        {"_id": ObjectId(request_id)}, {"$set": {"status": "declined"}}
    )
    return {"ok": True}


@router.delete("/buddies/requests/{request_id}")
async def cancel_request(request_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    req = await db.buddy_requests.find_one({"_id": ObjectId(request_id)})
    if not req or req["from_user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Request not found.")
    await db.buddy_requests.update_one(
        {"_id": ObjectId(request_id)}, {"$set": {"status": "cancelled"}}
    )
    return {"ok": True}


@router.get("/buddies/me")
async def my_buddy(user: dict = Depends(get_current_user)):
    db = get_db()
    pair = await _get_pair_for_user(db, user["id"])
    if not pair:
        return {"pair": None, "buddy": None}
    other_id = [m for m in pair["members"] if m != user["id"]][0]
    other = await db.users.find_one({"_id": ObjectId(other_id)})
    return {
        "pair": {
            "id": str(pair["_id"]),
            "members": pair["members"],
            "created_at": pair["created_at"],
        },
        "buddy": _public_user(other) if other else None,
    }


@router.delete("/buddies/me")
async def unpair(user: dict = Depends(get_current_user)):
    db = get_db()
    pair = await _get_pair_for_user(db, user["id"])
    if not pair:
        raise HTTPException(status_code=404, detail="No buddy to disconnect.")
    # Soft delete: archive entries but keep pair record for memory
    await db.pairs.delete_one({"_id": pair["_id"]})
    return {"ok": True}
