"""Smoke tests over the stub surface. Owner: Vir.

These assert that every endpoint in Plan.md section 7 exists and that the
committed examples validate against their response models, so a malformed
example fails here instead of in the frontend at 3 AM.
"""

import pytest
from fastapi.testclient import TestClient

from app.identity import Identity, demo_identity, normalize_email
from app.main import API_PREFIX, app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"


def test_readiness_reports_auth0_off(client):
    assert client.get("/readiness").json()["auth0"] is False


@pytest.mark.parametrize(
    "path",
    [
        "/companies",
        "/companies/cmp_okc_suds",
        "/markets/cmp_okc_suds/book",
        "/markets/cmp_okc_suds/batches",
        "/markets/cmp_okc_suds/trades",
        "/surveillance/flags",
        "/surveillance/audit",
    ],
)
def test_public_get_returns_valid_example(client, path):
    resp = client.get(f"{API_PREFIX}{path}")
    assert resp.status_code == 200, resp.text


def test_search_accepts_and_returns_intent(client):
    resp = client.post(f"{API_PREFIX}/discovery/search", json={"q": "laundromat in Oklahoma"})
    assert resp.status_code == 202
    assert resp.json()["intent"]["state"] == "OK"
    assert resp.json()["job_id"].startswith("job_")


def test_writes_require_demo_user(client):
    resp = client.post(
        f"{API_PREFIX}/markets/cmp_okc_suds/orders",
        json={"side": "buy", "qty": 10, "limit_price": 62.0},
    )
    assert resp.status_code == 401


def test_market_socket_sends_book(client):
    with client.websocket_connect("/ws/markets/cmp_okc_suds") as ws:
        msg = ws.receive_json()
    assert msg["type"] == "book"
    assert msg["data"]["market_id"] == "cmp_okc_suds"


# --- identity (see docs/DECISIONS.md 002) -----------------------------------


def test_email_is_normalized():
    assert normalize_email("  Vir@Example.COM ") == "vir@example.com"
    assert normalize_email("judge 3") is None


def test_email_demo_user_is_linkable():
    identity = demo_identity("Vir@Example.com")
    assert identity == Identity(
        subject="demo|vir@example.com",
        provider="demo",
        email="vir@example.com",
        name="vir",
    )


def test_bare_name_demo_user_has_no_email():
    identity = demo_identity("judge 3")
    assert identity.subject == "demo|judge-3"
    assert identity.email is None
    assert identity.name == "judge 3"


def test_same_email_different_case_is_one_subject():
    assert demo_identity("A@b.com").subject == demo_identity("a@B.COM ").subject
