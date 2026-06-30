"""Object storage wrapper with two backends:
   - 'emergent' : uses Emergent's hosted object storage (used in this preview)
   - 'local'    : writes files to a local directory (for Railway/Render/Docker/VPS self-hosting)

The backend is auto-selected:
  - If STORAGE_BACKEND env var is set, it wins ('emergent' | 'local').
  - Else if EMERGENT_LLM_KEY is present → 'emergent'.
  - Else → 'local'.

For self-hosting, you typically:
  STORAGE_BACKEND=local
  LOCAL_STORAGE_DIR=/var/data/butterfly   (or any writable mounted volume)

A future S3 / R2 backend can drop in here as a third option without changing any route code.
"""
import os
import logging
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
_storage_key: str | None = None


def app_name() -> str:
    return os.environ.get("APP_NAME", "butterfly")


def backend() -> str:
    explicit = os.environ.get("STORAGE_BACKEND")
    if explicit in ("emergent", "local"):
        return explicit
    return "emergent" if os.environ.get("EMERGENT_LLM_KEY") else "local"


def _local_root() -> Path:
    root = Path(os.environ.get("LOCAL_STORAGE_DIR", "/app/data/uploads"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def init_storage() -> str | None:
    """Initialize the chosen backend. Returns a non-empty marker if usable, else None."""
    global _storage_key
    if backend() == "local":
        root = _local_root()
        logger.info(f"Storage backend: local (dir={root})")
        return "local"
    if _storage_key:
        return _storage_key
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        logger.warning("EMERGENT_LLM_KEY not set — falling back to local storage")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        logger.info("Storage backend: emergent")
        return _storage_key
    except Exception as e:
        logger.error(f"Emergent storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Store `data` at `path`. Returns {path, size}."""
    if backend() == "local":
        root = _local_root()
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return {"path": path, "size": len(data)}
    key = init_storage()
    if not key:
        raise RuntimeError("Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    """Return (bytes, content_type)."""
    if backend() == "local":
        root = _local_root()
        target = root / path
        if not target.exists():
            raise FileNotFoundError(path)
        return target.read_bytes(), "application/octet-stream"
    key = init_storage()
    if not key:
        raise RuntimeError("Storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
