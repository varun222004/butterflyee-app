"""Regression tests for buddy lookup bug:
- 'No one with that handle or ID was found' on cross-account lookup
- False 'You cannot connect with yourself' on cross-account lookup
- Input normalization (whitespace, newlines, case, zero-width chars)
"""
import os
import uuid
import pytest
import requests


BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _email(tag):
    return f"TEST_buglk_{tag}_{uuid.uuid4().hex[:8]}@bf.io"


def _register(tag, display=None):
    s = requests.Session()
    email = _email(tag)
    r = s.post(
        f"{API}/auth/register",
        json={"email": email, "password": "pass1234", "display_name": display or f"User{tag}"},
    )
    assert r.status_code == 200, r.text
    return {"session": s, "user": r.json(), "email": email}


# ---------- Registration uniqueness ----------
class TestRegistrationIsolation:
    def test_two_accounts_get_unique_buddy_ids_and_ids(self):
        a = _register("a1")
        b = _register("b1")
        assert a["user"]["buddy_id"].startswith("BTF-")
        assert b["user"]["buddy_id"].startswith("BTF-")
        assert a["user"]["buddy_id"] != b["user"]["buddy_id"]
        assert a["user"]["id"] != b["user"]["id"]
        # Distinct cookie jars / sessions
        a_cookie = a["session"].cookies.get("access_token")
        b_cookie = b["session"].cookies.get("access_token")
        assert a_cookie and b_cookie
        assert a_cookie != b_cookie
        # /me returns each their own
        ma = a["session"].get(f"{API}/auth/me").json()
        mb = b["session"].get(f"{API}/auth/me").json()
        assert ma["buddy_id"] == a["user"]["buddy_id"]
        assert mb["buddy_id"] == b["user"]["buddy_id"]
        assert ma["id"] != mb["id"]


# ---------- Cross-account request (the original user bug) ----------
class TestCrossAccountRequest:
    def test_a_sends_to_b_no_self_error(self):
        a = _register("xa")
        b = _register("xb")
        # User A sends to user B by exact buddy_id
        r = a["session"].post(
            f"{API}/buddies/request", json={"identifier": b["user"]["buddy_id"]}
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        assert body["status"] == "pending"
        assert "id" in body
        # No 'self' error message should fire — defensive check
        assert "yourself" not in r.text.lower()
        assert "your own butterfly" not in r.text.lower()

    def test_b_sees_incoming_then_accepts(self):
        a = _register("ya")
        b = _register("yb")
        rr = a["session"].post(
            f"{API}/buddies/request", json={"identifier": b["user"]["buddy_id"]}
        )
        assert rr.status_code == 200, rr.text
        # B fetches incoming
        rl = b["session"].get(f"{API}/buddies/requests")
        assert rl.status_code == 200
        incoming = rl.json()["incoming"]
        assert any(i["user"]["buddy_id"] == a["user"]["buddy_id"] for i in incoming)
        req_id = [i for i in incoming if i["user"]["buddy_id"] == a["user"]["buddy_id"]][0]["id"]
        # B accepts
        racc = b["session"].post(f"{API}/buddies/requests/{req_id}/accept")
        assert racc.status_code == 200, racc.text
        # Both /buddies/me now have pair
        ma = a["session"].get(f"{API}/buddies/me").json()
        mb = b["session"].get(f"{API}/buddies/me").json()
        assert ma["pair"] is not None and mb["pair"] is not None
        assert ma["buddy"]["buddy_id"] == b["user"]["buddy_id"]
        assert mb["buddy"]["buddy_id"] == a["user"]["buddy_id"]


# ---------- Input normalization tests ----------
class TestLookupNormalization:
    @pytest.fixture(scope="class")
    def pair(self):
        a = _register("na")
        b = _register("nb")
        return {"a": a, "b": b}

    def test_lookup_with_trailing_whitespace(self, pair):
        a, b = pair["a"], pair["b"]
        r = a["session"].get(
            f"{API}/users/lookup", params={"q": b["user"]["buddy_id"] + "   "}
        )
        assert r.status_code == 200
        assert r.json()["user"] is not None
        assert r.json()["user"]["buddy_id"] == b["user"]["buddy_id"]

    def test_lookup_with_newline(self, pair):
        a, b = pair["a"], pair["b"]
        r = a["session"].get(
            f"{API}/users/lookup", params={"q": "\n" + b["user"]["buddy_id"] + "\n"}
        )
        assert r.status_code == 200
        assert r.json()["user"] is not None
        assert r.json()["user"]["buddy_id"] == b["user"]["buddy_id"]

    def test_lookup_lowercase_buddy_id(self, pair):
        a, b = pair["a"], pair["b"]
        r = a["session"].get(
            f"{API}/users/lookup", params={"q": b["user"]["buddy_id"].lower()}
        )
        assert r.status_code == 200
        assert r.json()["user"] is not None
        assert r.json()["user"]["buddy_id"] == b["user"]["buddy_id"]

    def test_lookup_mixed_case_buddy_id(self, pair):
        a, b = pair["a"], pair["b"]
        bid = b["user"]["buddy_id"]
        mixed = "".join(
            ch.lower() if i % 2 == 0 else ch.upper() for i, ch in enumerate(bid)
        )
        r = a["session"].get(f"{API}/users/lookup", params={"q": mixed})
        assert r.status_code == 200
        assert r.json()["user"] is not None
        assert r.json()["user"]["buddy_id"] == bid

    def test_lookup_with_zero_width_char(self, pair):
        a, b = pair["a"], pair["b"]
        bid = b["user"]["buddy_id"]
        # Insert zero-width space and BOM
        polluted = "\u200b" + bid + "\ufeff"
        r = a["session"].get(f"{API}/users/lookup", params={"q": polluted})
        assert r.status_code == 200
        assert r.json()["user"] is not None
        assert r.json()["user"]["buddy_id"] == bid

    def test_send_request_with_trailing_whitespace_buddy_id(self, pair):
        # Use a fresh pair to avoid existing-request collisions
        a = _register("wsa")
        b = _register("wsb")
        r = a["session"].post(
            f"{API}/buddies/request",
            json={"identifier": b["user"]["buddy_id"] + "   "},
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pending"

    def test_send_request_lowercase_buddy_id(self):
        a = _register("lca")
        b = _register("lcb")
        r = a["session"].post(
            f"{API}/buddies/request",
            json={"identifier": b["user"]["buddy_id"].lower()},
        )
        assert r.status_code == 200, r.text

    def test_send_request_mixed_case_buddy_id(self):
        a = _register("mca")
        b = _register("mcb")
        bid = b["user"]["buddy_id"]
        mixed = "".join(
            ch.lower() if i % 2 == 0 else ch.upper() for i, ch in enumerate(bid)
        )
        r = a["session"].post(f"{API}/buddies/request", json={"identifier": mixed})
        assert r.status_code == 200, r.text

    def test_send_request_with_newline_and_zwsp(self):
        a = _register("zwa")
        b = _register("zwb")
        polluted = "\n\u200b" + b["user"]["buddy_id"] + "\ufeff "
        r = a["session"].post(f"{API}/buddies/request", json={"identifier": polluted})
        assert r.status_code == 200, r.text


# ---------- Error wording tests ----------
class TestErrorWording:
    def test_not_found_message(self):
        a = _register("nf")
        r = a["session"].post(
            f"{API}/buddies/request", json={"identifier": "BTF-XXXX-XXXX"}
        )
        assert r.status_code == 404
        assert r.json()["detail"] == "No one with that handle or ID was found."

    def test_self_via_buddy_id_message(self):
        a = _register("self1")
        me = a["session"].get(f"{API}/auth/me").json()
        r = a["session"].post(
            f"{API}/buddies/request", json={"identifier": me["buddy_id"]}
        )
        assert r.status_code == 400
        assert (
            r.json()["detail"]
            == "That looks like your own Butterfly ID — try theirs instead."
        )

    def test_self_via_handle_message(self):
        a = _register("self2")
        handle = "selfh" + uuid.uuid4().hex[:6]
        ph = a["session"].put(f"{API}/profile/me", json={"handle": handle})
        assert ph.status_code == 200
        r = a["session"].post(
            f"{API}/buddies/request", json={"identifier": "@" + handle}
        )
        assert r.status_code == 400
        assert (
            r.json()["detail"]
            == "That looks like your own Butterfly ID — try theirs instead."
        )


# ---------- Handle lookup ----------
class TestHandleLookup:
    def test_handle_with_and_without_at_prefix(self):
        a = _register("hl1")
        b = _register("hl2")
        handle = "hlb" + uuid.uuid4().hex[:6]
        b["session"].put(f"{API}/profile/me", json={"handle": handle})
        # without @
        r1 = a["session"].get(f"{API}/users/lookup", params={"q": handle})
        assert r1.status_code == 200 and r1.json()["user"]["handle"] == handle
        # with @
        r2 = a["session"].get(f"{API}/users/lookup", params={"q": "@" + handle})
        assert r2.status_code == 200 and r2.json()["user"]["handle"] == handle
        # uppercase
        r3 = a["session"].get(f"{API}/users/lookup", params={"q": handle.upper()})
        assert r3.status_code == 200 and r3.json()["user"]["handle"] == handle
