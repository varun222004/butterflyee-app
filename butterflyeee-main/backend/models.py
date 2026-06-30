"""Pydantic models for API I/O. Mongo documents are stored as dicts; we serialize ids to str."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal, Any


# ----- Auth -----
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    buddy_id: str
    handle: Optional[str] = None
    display_name: Optional[str] = None
    created_at: str
    onboarded: bool = False


# ----- Profile -----
class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    handle: Optional[str] = None


# ----- Buddy -----
class BuddyRequestCreate(BaseModel):
    # Accept either a handle like "@varun" or a BTF-XXXX-XXXX id
    identifier: str


class BuddyRequest(BaseModel):
    id: str
    from_user_id: str
    to_user_id: str
    from_user: Optional[dict] = None
    to_user: Optional[dict] = None
    status: Literal["pending", "accepted", "declined", "cancelled"]
    created_at: str


class Pair(BaseModel):
    id: str
    members: list[str]
    buddy: Optional[dict] = None
    created_at: str


# ----- Entries -----
RoomKey = Literal[
    "appreciation", "letters", "memories", "butterfly_lounge",
    "good_night", "dog_cafe", "doctor_corner", "achievements",
    "surprises", "secret_room", "shared_journal", "bucket_list",
]
World = Literal["personal", "shared"]
EntryStatus = Literal["draft", "scheduled", "published", "archived"]


class EntryCreate(BaseModel):
    room_key: RoomKey
    title: Optional[str] = ""
    body: Optional[str] = ""
    media_path: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    status: EntryStatus = "published"
    publish_at: Optional[str] = None  # ISO string


class EntryUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    media_path: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    status: Optional[EntryStatus] = None
    publish_at: Optional[str] = None


class Entry(BaseModel):
    id: str
    pair_id: str
    room_key: str
    world: World
    target_user_id: Optional[str] = None
    author_user_id: str
    author: Optional[dict] = None
    title: str = ""
    body: str = ""
    media_path: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    status: EntryStatus
    publish_at: Optional[str] = None
    created_at: str
    updated_at: str
