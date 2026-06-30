"""Shared helpers: buddy id generation, handle validation, timestamp helpers."""
import secrets
import string
import re
from datetime import datetime, timezone


_ID_ALPHABET = string.ascii_uppercase + string.digits
# Avoid easily-confused characters
_SAFE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_buddy_id() -> str:
    """Generate a buddy id like BTF-K2D9-XQ81."""
    chunk_a = "".join(secrets.choice(_SAFE) for _ in range(4))
    chunk_b = "".join(secrets.choice(_SAFE) for _ in range(4))
    return f"BTF-{chunk_a}-{chunk_b}"


_HANDLE_RE = re.compile(r"^[a-z0-9_]{3,20}$")


def normalize_handle(handle: str) -> str:
    h = handle.strip().lower()
    if h.startswith("@"):
        h = h[1:]
    return h


def is_valid_handle(handle: str) -> bool:
    return bool(_HANDLE_RE.match(handle))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sorted_pair_members(a: str, b: str) -> list[str]:
    return sorted([a, b])
