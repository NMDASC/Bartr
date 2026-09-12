"""Shared singletons and auth dependency."""
from __future__ import annotations

import os

from fastapi import Header, HTTPException

from app.services.market.engine import Engine
from app.services.market.hub import Hub
from app.store import MemoryStore

STATE_FILE = os.getenv("STATE_FILE")  # e.g. data/state.json; unset = pure in-memory
DEMO_AUTH = os.getenv("DEMO_AUTH", "1") == "1"

hub = Hub()
store = MemoryStore(STATE_FILE)
engine = Engine(store, hub)


def current_user(x_demo_user: str | None = Header(default=None), authorization: str | None = Header(default=None)) -> str:
    """Demo mode: X-Demo-User: <name>. Auth0 bearer verification is role D's job; until then
    a bearer token is accepted as an opaque user id so the frontend wiring does not change."""
    if x_demo_user and DEMO_AUTH:
        uid = x_demo_user.strip()[:40]
        if uid in ("treasury",) or uid.startswith("bot") or uid.startswith("wash_"):
            raise HTTPException(403, "reserved user id")
        return uid
    if authorization and authorization.lower().startswith("bearer "):
        return "auth0_" + authorization[7:][:24]
    raise HTTPException(401, "send X-Demo-User: <name> (DEMO_AUTH=1) or an Authorization bearer")
