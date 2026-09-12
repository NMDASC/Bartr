"""Shared singletons and auth dependency."""
from __future__ import annotations

import os

from fastapi import Header, HTTPException

from app import identity as ident
from app.env import load_env
from app.services.market.engine import Engine
from app.services.market.hub import Hub
from app.store import MemoryStore

load_env()  # before any getenv below, so .env actually reaches the app

STATE_FILE = os.getenv("STATE_FILE")  # e.g. data/state.json; unset = pure in-memory
MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
MONGODB_DB = os.getenv("MONGODB_DB", "jb")
DEMO_AUTH = os.getenv("DEMO_AUTH", "1") == "1"

hub = Hub()

# Decision 005 left the seam for the real database as another class with the
# same methods. Set MONGODB_URI to take it; unset falls back to the in-memory
# store so tests and a keyless laptop still run.
if MONGODB_URI:
    from app.store_mongo import MongoStore

    store = MongoStore(MONGODB_URI, MONGODB_DB)
    STORE_KIND = "mongo"
else:
    store = MemoryStore(STATE_FILE)
    STORE_KIND = "memory"

engine = Engine(store, hub)

RESERVED_PREFIXES = ("bot", "wash_")
RESERVED_IDS = ("treasury",)


def current_user(
    x_demo_user: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> str:
    """Demo mode: X-Demo-User: <name, email or phone>.

    The value is normalized in app/identity.py so one person cannot become two
    accounts through casing or phone formatting, and so an email identity can
    be claimed by a real login later. Auth0 bearer verification is still not
    wired; until it is, a bearer token is accepted as an opaque user id so the
    frontend wiring does not change.
    """
    if x_demo_user and DEMO_AUTH:
        candidate = ident.normalize(x_demo_user)
        if not candidate.uid:
            raise HTTPException(401, "X-Demo-User must not be empty")
        if candidate.uid in RESERVED_IDS or candidate.uid.startswith(RESERVED_PREFIXES):
            raise HTTPException(403, "reserved user id")
        resolved = ident.claim(store, candidate)
        engine.user(resolved.uid)  # get or create, owns the starting cash
        ident.record(store, resolved)
        return resolved.uid

    if authorization and authorization.lower().startswith("bearer "):
        return "auth0_" + authorization[7:][:24]

    raise HTTPException(401, "send X-Demo-User: <name> (DEMO_AUTH=1) or an Authorization bearer")
