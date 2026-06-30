"""Verify the new storage portability layer (local vs emergent backend)."""
import os
import sys
import subprocess
import tempfile
import shutil
import importlib
import pytest

BACKEND_DIR = "/app/backend"


def test_backend_local_via_env_override():
    """Subprocess: STORAGE_BACKEND=local => backend() returns 'local' even with EMERGENT_LLM_KEY set."""
    env = os.environ.copy()
    env["STORAGE_BACKEND"] = "local"
    out = subprocess.check_output(
        [sys.executable, "-c", "from storage import backend; print(backend())"],
        cwd=BACKEND_DIR, env=env, text=True,
    ).strip()
    assert out == "local", f"Expected 'local', got {out!r}"


def test_backend_emergent_when_key_set():
    env = os.environ.copy()
    env.pop("STORAGE_BACKEND", None)
    env["EMERGENT_LLM_KEY"] = "fake_key_for_test"
    out = subprocess.check_output(
        [sys.executable, "-c", "from storage import backend; print(backend())"],
        cwd=BACKEND_DIR, env=env, text=True,
    ).strip()
    assert out == "emergent"


def test_backend_falls_back_to_local_with_no_key():
    env = os.environ.copy()
    env.pop("STORAGE_BACKEND", None)
    env.pop("EMERGENT_LLM_KEY", None)
    out = subprocess.check_output(
        [sys.executable, "-c", "from storage import backend; print(backend())"],
        cwd=BACKEND_DIR, env=env, text=True,
    ).strip()
    assert out == "local"


def test_local_put_get_roundtrip(monkeypatch, tmp_path):
    """put_object then get_object roundtrip on local fs."""
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("LOCAL_STORAGE_DIR", str(tmp_path))
    sys.path.insert(0, BACKEND_DIR)
    import storage
    importlib.reload(storage)
    try:
        result = storage.put_object("test/file.txt", b"hello", "text/plain")
        assert result["path"] == "test/file.txt"
        assert result["size"] == 5

        target = tmp_path / "test" / "file.txt"
        assert target.exists()
        assert target.read_bytes() == b"hello"

        data, ctype = storage.get_object("test/file.txt")
        assert data == b"hello"
        assert ctype == "application/octet-stream"
    finally:
        # Restore module to env state (without STORAGE_BACKEND override)
        importlib.reload(storage)


def test_local_get_missing_raises_filenotfound(monkeypatch, tmp_path):
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("LOCAL_STORAGE_DIR", str(tmp_path))
    sys.path.insert(0, BACKEND_DIR)
    import storage
    importlib.reload(storage)
    try:
        with pytest.raises(FileNotFoundError):
            storage.get_object("does/not/exist.txt")
    finally:
        importlib.reload(storage)


def test_files_route_returns_404_for_missing_path():
    """The /api/files/{path} route should return 404 (not 502) for non-existent paths.
    Using the live preview URL — with EMERGENT_LLM_KEY set, the path won't exist in the
    DB so the route returns 404 before ever touching storage. This validates the contract."""
    import requests
    BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
    r = requests.get(f"{BASE_URL}/api/files/butterfly/nonexistent/path.bin")
    assert r.status_code == 404, f"Expected 404 got {r.status_code}: {r.text}"
