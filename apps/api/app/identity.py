"""Who is calling. Owner: Vir.

Demo auth is the only implemented path (Plan.md section 7, `DEMO_AUTH=1` plus
`X-Demo-User`). Auth0 is deliberately not wired yet, but the storage shape here
is the one a real login will use, so adding it later touches this file only.

The contract with the rest of the codebase:

    every row that references a person uses `users._id`, never a subject string

That is what lets a demo session become a signed-in account without rewriting
orders, positions, trades or flags. A user document accumulates subjects:

    { _id, auth_subs: ["demo|a@b.com", "auth0|65f3a1"], email: "a@b.com", ... }

Resolution order:
  1. match any linked subject  -> that user
  2. else match verified email -> link the new subject onto that user ($addToSet)
  3. else create the user

Step 2 is account linking by email. It is why signing in later with the same
address inherits the demo session's cash, positions and orders instead of
starting a fresh account. Note the standard caveat: link only on addresses you
believe, because whoever holds an address inherits whatever was built under it.
Play money makes that acceptable here; real money would not.
"""

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from .config import Settings, get_settings
from .db import db_or_none

STARTING_CASH = 100_000.0

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class Identity:
    """A caller, normalized. Produced by demo auth today, by Auth0 later."""

    subject: str  # "demo|..." or "auth0|..."; stable per provider
    provider: str  # "demo" | "auth0"
    email: str | None
    name: str


def normalize_email(raw: str) -> str | None:
    email = raw.strip().lower()
    return email if _EMAIL_RE.match(email) else None


def _display_name(raw: str, email: str | None) -> str:
    if raw.strip() and normalize_email(raw) is None:
        return raw.strip()
    return email.split("@")[0] if email else raw.strip() or "anonymous"


def demo_identity(header_value: str) -> Identity:
    """`X-Demo-User` accepts a bare name or an email address.

    An email is what makes the account claimable later, so prefer it when the
    caller has one. A bare name still works for judges scanning the QR code,
    it just cannot be linked to a future login.
    """
    raw = header_value.strip()
    if not raw:
        raise HTTPException(status_code=401, detail="X-Demo-User must not be empty")
    email = normalize_email(raw)
    subject = f"demo|{email}" if email else f"demo|{_slug(raw)}"
    return Identity(subject=subject, provider="demo", email=email, name=_display_name(raw, email))


def _slug(raw: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-") or "anonymous"


async def provision(db: AsyncIOMotorDatabase, identity: Identity) -> dict[str, Any]:
    """Find or create the user for this identity. Idempotent."""
    now = datetime.now(timezone.utc)

    existing = await db.users.find_one({"auth_subs": identity.subject})
    if existing is not None:
        return existing

    if identity.email:
        linked = await db.users.find_one_and_update(
            {"email": identity.email},
            {
                "$addToSet": {"auth_subs": identity.subject},
                "$set": {"auth_provider": identity.provider, "last_seen_at": now},
            },
            return_document=ReturnDocument.AFTER,
        )
        if linked is not None:
            return linked

    doc = {
        "auth_subs": [identity.subject],
        "auth_provider": identity.provider,
        "email": identity.email,
        "name": identity.name,
        "cash": STARTING_CASH,
        "risk_profile": {},
        "created_at": now,
        "last_seen_at": now,
    }
    try:
        result = await db.users.insert_one(doc)
    except DuplicateKeyError:
        # Concurrent first request for the same person; the other one won.
        found = await db.users.find_one({"auth_subs": identity.subject})
        if found is None and identity.email:
            found = await db.users.find_one({"email": identity.email})
        if found is None:
            raise
        return found
    doc["_id"] = result.inserted_id
    return doc


async def get_current_user(
    x_demo_user: str | None = Header(default=None, alias="X-Demo-User"),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Resolve the caller to a user document, creating it on first contact.

    When Auth0 lands, a bearer token is parsed into an `Identity` here and the
    rest of the function is unchanged. Nothing downstream branches on provider.

    The database is resolved by hand rather than with `Depends(get_db)` so that
    authentication is decided before it is touched: an unauthenticated request
    must get 401, not the 503 that a missing database would raise first.
    """
    if not (settings.demo_auth and x_demo_user):
        raise HTTPException(
            status_code=401,
            detail="send X-Demo-User: <name or email> (DEMO_AUTH=1); Auth0 login is not wired yet",
        )

    identity = demo_identity(x_demo_user)

    db = db_or_none()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="database unavailable; start mongo (docker compose up mongo) or set MONGODB_URI",
        )
    return await provision(db, identity)
