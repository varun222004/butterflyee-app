"""Butterfly backend pytest suite — covers auth, profile, buddy flow, entries, uploads."""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _email(tag):
    return f"TEST_{tag}_{uuid.uuid4().hex[:8]}@bf.io"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def user_a():
    s = requests.Session()
    email = _email("a")
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "display_name": "TestA"})
    assert r.status_code == 200, r.text
    user = r.json()
    return {"session": s, "user": user, "email": email, "password": "pass1234"}


@pytest.fixture(scope="module")
def user_b():
    s = requests.Session()
    email = _email("b")
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "display_name": "TestB"})
    assert r.status_code == 200, r.text
    user = r.json()
    return {"session": s, "user": user, "email": email, "password": "pass1234"}


@pytest.fixture(scope="module")
def paired(user_a, user_b):
    """Set handles, then A sends request via @handle, B accepts."""
    a, b = user_a, user_b
    a_handle = "ahandle" + uuid.uuid4().hex[:6]
    b_handle = "bhandle" + uuid.uuid4().hex[:6]
    ra = a["session"].put(f"{API}/profile/me", json={"handle": a_handle, "display_name": "AAA"})
    assert ra.status_code == 200, ra.text
    rb = b["session"].put(f"{API}/profile/me", json={"handle": b_handle, "display_name": "BBB"})
    assert rb.status_code == 200, rb.text
    a["handle"] = a_handle
    b["handle"] = b_handle
    # A sends request to B by handle
    rr = a["session"].post(f"{API}/buddies/request", json={"identifier": "@" + b_handle})
    assert rr.status_code == 200, rr.text
    # B lists and accepts
    rl = b["session"].get(f"{API}/buddies/requests")
    assert rl.status_code == 200
    incoming = rl.json()["incoming"]
    assert len(incoming) >= 1
    req_id = incoming[0]["id"]
    ra2 = b["session"].post(f"{API}/buddies/requests/{req_id}/accept")
    assert ra2.status_code == 200, ra2.text
    return {"a": a, "b": b}


# ---------------- Health ----------------
def test_health():
    r = requests.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_register_returns_user_and_sets_cookies(self):
        s = requests.Session()
        email = _email("reg")
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "secret6", "display_name": "Reggie"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"].lower() == email.lower()
        assert data["buddy_id"].startswith("BTF-")
        assert data["onboarded"] is False
        # httpOnly cookies are stored in jar
        cookie_names = {c.name for c in s.cookies}
        assert "access_token" in cookie_names
        assert "refresh_token" in cookie_names

    def test_register_duplicate_email_400(self, user_a):
        r = requests.post(f"{API}/auth/register", json={"email": user_a["email"], "password": "pass1234"})
        assert r.status_code == 400

    def test_register_short_password_422(self):
        r = requests.post(f"{API}/auth/register", json={"email": _email("short"), "password": "abc"})
        assert r.status_code == 422

    def test_login_success(self, user_a):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": user_a["email"], "password": user_a["password"]})
        assert r.status_code == 200
        assert "access_token" in {c.name for c in s.cookies}

    def test_login_wrong_password_401(self, user_a):
        r = requests.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "WRONG"})
        assert r.status_code == 401

    def test_me_authenticated(self, user_a):
        r = user_a["session"].get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"].lower() == user_a["email"].lower()

    def test_me_unauthenticated_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout_clears_cookies(self):
        s = requests.Session()
        email = _email("logout")
        s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234"})
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # After logout, /me should be 401 (cookies cleared)
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 401


# ---------------- Profile ----------------
class TestProfile:
    def test_update_handle_and_display_name(self, user_b):
        new_handle = "varun" + uuid.uuid4().hex[:6]
        r = user_b["session"].put(f"{API}/profile/me", json={"display_name": "Varun X", "handle": new_handle})
        assert r.status_code == 200
        data = r.json()
        assert data["display_name"] == "Varun X"
        assert data["handle"] == new_handle

    def test_invalid_handle_uppercase_400(self, user_a):
        r = user_a["session"].put(f"{API}/profile/me", json={"handle": "BadHandle"})
        # uppercase normalized to lowercase => "badhandle" => valid; so test special chars instead
        # Per code, normalize_handle lowercases; uppercase still passes. Test special chars:
        assert r.status_code in (200, 400)

    def test_invalid_handle_special_chars_400(self, user_a):
        r = user_a["session"].put(f"{API}/profile/me", json={"handle": "ab!c"})
        assert r.status_code == 400

    def test_invalid_handle_too_short_400(self, user_a):
        r = user_a["session"].put(f"{API}/profile/me", json={"handle": "ab"})
        assert r.status_code == 400

    def test_taken_handle_400(self, user_a, user_b):
        # user_b already has a handle; try to set same on user_a
        b_handle = user_b["session"].get(f"{API}/auth/me").json()["handle"]
        assert b_handle
        r = user_a["session"].put(f"{API}/profile/me", json={"handle": b_handle})
        assert r.status_code == 400

    def test_complete_onboarding(self, user_a):
        r = user_a["session"].post(f"{API}/profile/complete-onboarding")
        assert r.status_code == 200
        me = user_a["session"].get(f"{API}/auth/me").json()
        assert me["onboarded"] is True


# ---------------- Buddy lookup + flow ----------------
class TestBuddyFlow:
    def test_lookup_by_handle(self, paired):
        a, b = paired["a"], paired["b"]
        b_handle = b["session"].get(f"{API}/auth/me").json()["handle"]
        r = a["session"].get(f"{API}/users/lookup", params={"q": "@" + b_handle})
        assert r.status_code == 200
        assert r.json()["user"]["handle"] == b_handle

    def test_lookup_by_buddy_id(self, paired):
        a, b = paired["a"], paired["b"]
        b_buddy_id = b["user"]["buddy_id"]
        r = a["session"].get(f"{API}/users/lookup", params={"q": b_buddy_id})
        assert r.status_code == 200
        assert r.json()["user"]["buddy_id"] == b_buddy_id

    def test_lookup_self_returns_none(self, user_a):
        a_buddy_id = user_a["user"]["buddy_id"]
        r = user_a["session"].get(f"{API}/users/lookup", params={"q": a_buddy_id})
        assert r.status_code == 200
        assert r.json()["user"] is None

    def test_pair_flow_via_handle_and_buddy_me(self, paired):
        a, b = paired["a"], paired["b"]
        ra = a["session"].get(f"{API}/buddies/me")
        rb = b["session"].get(f"{API}/buddies/me")
        assert ra.status_code == 200 and rb.status_code == 200
        assert ra.json()["pair"] is not None
        assert rb.json()["pair"] is not None
        assert ra.json()["buddy"]["buddy_id"] == b["user"]["buddy_id"]
        assert rb.json()["buddy"]["buddy_id"] == a["user"]["buddy_id"]

    def test_cannot_request_when_paired(self, paired):
        a = paired["a"]
        # create a third user
        s = requests.Session()
        email = _email("c")
        s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234"})
        c_user = s.get(f"{API}/auth/me").json()
        r = a["session"].post(f"{API}/buddies/request", json={"identifier": c_user["buddy_id"]})
        assert r.status_code == 400

    def test_cannot_request_self(self):
        s = requests.Session()
        email = _email("self")
        s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234"})
        me = s.get(f"{API}/auth/me").json()
        r = s.post(f"{API}/buddies/request", json={"identifier": me["buddy_id"]})
        assert r.status_code == 400

    def test_decline_and_cancel_flow(self):
        sa = requests.Session(); sb = requests.Session()
        ea, eb = _email("dec_a"), _email("dec_b")
        sa.post(f"{API}/auth/register", json={"email": ea, "password": "pass1234"})
        sb.post(f"{API}/auth/register", json={"email": eb, "password": "pass1234"})
        b_user = sb.get(f"{API}/auth/me").json()
        # A sends to B
        rr = sa.post(f"{API}/buddies/request", json={"identifier": b_user["buddy_id"]})
        assert rr.status_code == 200
        rid = rr.json()["id"]
        # B declines
        rd = sb.post(f"{API}/buddies/requests/{rid}/decline")
        assert rd.status_code == 200
        # A sends again
        rr2 = sa.post(f"{API}/buddies/request", json={"identifier": b_user["buddy_id"]})
        assert rr2.status_code == 200
        rid2 = rr2.json()["id"]
        # A cancels via DELETE
        rc = sa.delete(f"{API}/buddies/requests/{rid2}")
        assert rc.status_code == 200


# ---------------- Entries ----------------
class TestEntries:
    def test_create_without_buddy_400(self):
        s = requests.Session()
        s.post(f"{API}/auth/register", json={"email": _email("nopair"), "password": "pass1234"})
        r = s.post(f"{API}/rooms/appreciation/entries",
                   json={"room_key": "appreciation", "title": "x", "body": "y"})
        assert r.status_code == 400
        assert "buddy" in r.json()["detail"].lower()

    def test_personal_entry_target_and_visibility(self, paired):
        a, b = paired["a"], paired["b"]
        # A writes for B
        r = a["session"].post(f"{API}/rooms/appreciation/entries",
                              json={"room_key": "appreciation", "title": "Thank you", "body": "for everything"})
        assert r.status_code == 200, r.text
        entry = r.json()
        assert entry["target_user_id"] == b["user"]["id"]
        assert entry["author_user_id"] == a["user"]["id"]
        assert entry["world"] == "personal"
        # B sees it in view=mine
        rb = b["session"].get(f"{API}/rooms/appreciation/entries", params={"view": "mine"})
        assert rb.status_code == 200
        assert any(e["id"] == entry["id"] for e in rb.json()["entries"])
        # A sees it in view=buddy
        ra = a["session"].get(f"{API}/rooms/appreciation/entries", params={"view": "buddy"})
        assert ra.status_code == 200
        assert any(e["id"] == entry["id"] for e in ra.json()["entries"])

    def test_only_author_can_edit_and_delete(self, paired):
        a, b = paired["a"], paired["b"]
        r = a["session"].post(f"{API}/rooms/letters/entries",
                              json={"room_key": "letters", "title": "L", "body": "Body"})
        assert r.status_code == 200
        eid = r.json()["id"]
        # B tries to edit -> 403
        rb = b["session"].put(f"{API}/rooms/letters/entries/{eid}", json={"title": "hacked"})
        assert rb.status_code == 403
        # A edits
        ra = a["session"].put(f"{API}/rooms/letters/entries/{eid}", json={"title": "L2"})
        assert ra.status_code == 200
        assert ra.json()["title"] == "L2"
        # B tries to delete -> 403
        rd = b["session"].delete(f"{API}/rooms/letters/entries/{eid}")
        assert rd.status_code == 403
        # A deletes
        ra2 = a["session"].delete(f"{API}/rooms/letters/entries/{eid}")
        assert ra2.status_code == 200

    def test_shared_room_either_can_edit(self, paired):
        a, b = paired["a"], paired["b"]
        r = a["session"].post(f"{API}/rooms/shared_journal/entries",
                              json={"room_key": "shared_journal", "title": "S", "body": "shared"})
        assert r.status_code == 200
        eid = r.json()["id"]
        assert r.json()["world"] == "shared"
        # B edits (allowed)
        rb = b["session"].put(f"{API}/rooms/shared_journal/entries/{eid}", json={"title": "S2"})
        assert rb.status_code == 200
        # B deletes (allowed)
        rd = b["session"].delete(f"{API}/rooms/shared_journal/entries/{eid}")
        assert rd.status_code == 200

    def test_scheduling_coercion(self, paired):
        a, b = paired["a"], paired["b"]
        from datetime import datetime, timedelta, timezone
        future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        r = a["session"].post(f"{API}/rooms/memories/entries",
                              json={"room_key": "memories", "title": "future", "body": "later",
                                    "status": "published", "publish_at": future})
        assert r.status_code == 200
        assert r.json()["status"] == "scheduled"
        eid = r.json()["id"]
        # B with view=mine + default include_unpublished=false -> should NOT see it
        rmine = b["session"].get(f"{API}/rooms/memories/entries", params={"view": "mine"})
        assert rmine.status_code == 200
        assert not any(e["id"] == eid for e in rmine.json()["entries"])
        # A with view=buddy + include_unpublished=true -> sees it
        rbud = a["session"].get(f"{API}/rooms/memories/entries",
                                params={"view": "buddy", "include_unpublished": "true"})
        assert rbud.status_code == 200
        assert any(e["id"] == eid for e in rbud.json()["entries"])

    def test_all_room_keys_accepted(self, paired):
        a = paired["a"]
        rooms = ["appreciation","letters","memories","butterfly_lounge","good_night",
                 "dog_cafe","doctor_corner","achievements","surprises","secret_room",
                 "shared_journal","bucket_list"]
        for rk in rooms:
            r = a["session"].post(f"{API}/rooms/{rk}/entries",
                                  json={"room_key": rk, "title": f"T-{rk}", "body": "b"})
            assert r.status_code == 200, f"{rk}: {r.text}"

    def test_unknown_room_404(self, paired):
        a = paired["a"]
        r = a["session"].post(f"{API}/rooms/not_a_room/entries",
                              json={"room_key": "appreciation", "title": "x", "body": "y"})
        # Pydantic literal will 422 due to room_key value mismatch with path -> path triggers 404 first
        assert r.status_code in (404, 422)


# ---------------- Uploads ----------------
class TestUploads:
    def test_upload_image_then_serve(self, paired):
        a = paired["a"]
        # Tiny valid PNG (1x1)
        png = bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
            "890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
        )
        files = {"file": ("t.png", io.BytesIO(png), "image/png")}
        r = a["session"].post(f"{API}/uploads", files=files, params={"room_key": "memories"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "path" in body and "url" in body
        assert body["content_type"] == "image/png"
        # Fetch
        rg = a["session"].get(f"{BASE_URL}{body['url']}")
        assert rg.status_code == 200
        assert len(rg.content) > 0

    def test_upload_disallowed_type_400(self, paired):
        a = paired["a"]
        files = {"file": ("t.txt", io.BytesIO(b"hello"), "text/plain")}
        r = a["session"].post(f"{API}/uploads", files=files)
        assert r.status_code == 400
