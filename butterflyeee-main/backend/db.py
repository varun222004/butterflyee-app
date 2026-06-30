"""Database connection, indexes, and shared collections."""
from motor.motor_asyncio import AsyncIOMotorClient
import os

_client: AsyncIOMotorClient | None = None
_db = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return _client


def get_db():
    global _db
    if _db is None:
        _db = get_client()[os.environ["DB_NAME"]]
    return _db


async def ensure_indexes():
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("buddy_id", unique=True)
    await db.users.create_index(
        "handle",
        unique=True,
        partialFilterExpression={"handle": {"$type": "string"}},
    )
    await db.buddy_requests.create_index([("from_user_id", 1), ("to_user_id", 1)])
    await db.buddy_requests.create_index("status")
    await db.pairs.create_index("members")
    await db.entries.create_index([("pair_id", 1), ("room_key", 1), ("world", 1)])
    await db.entries.create_index([("target_user_id", 1), ("status", 1)])
    await db.entries.create_index("publish_at")
    await db.files.create_index([("pair_id", 1), ("room_key", 1)])
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
