"""Who is calling. Owner: Vir. See docs/DECISIONS.md 006.

Demo auth is the only implemented path (`DEMO_AUTH=1`, header `X-Demo-User`).
Auth0 is deliberately not wired, but the storage shape is the one a real login
will use, so adding it later touches this file only.

The `users` shape comes from migrations 001 and 006:

    { _id, name, display_name, email, auth0_sub, cash, risk_profile, created_at }

`name` is the identity key (unique), which is why `display_name` exists
separately: two judges who both type "vir" must not collide, and an email
identity should not be rendered as a raw address in the UI.

Resolution order:
  1. auth0_sub, when the caller has one
  2. email, attaching the sub to that user
  3. name
  4. create

Step 2 is account linking by email. It is why signing in later with the same
address inherits the demo session's cash, positions and orders instead of
starting over. The standard caveat applies: whoever controls an address
inherits whatever was built under it, which play money makes acceptable and
real money would not.

The rest of the codebase must reference people by `users._id` only, never by
`name` and never by a subject string. That is what makes the upgrade free.
"""

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from .config import Settings, get_settings
from .db import require_db

# Mirrors migrations/001_users.py. Keep them in step.
STARTING_CASH = 100_000
DEFAULT_RISK_PROFILE = {
    "tolerance": 0.5,
    "horizon": "medium",
    "sectors": [],
    "states": [],
    "budget": STARTING_CASH,
}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class Identity:
    """A caller, normalized. Produced by demo auth today, by Auth0 later."""

    name: str  # identity key, unique
    display_name: str
    email: str | None
    auth0_sub: str | None
    provider: str  # "demo" | "auth0"


def normalize_email(raw: str) -> str | None:
    email = raw.strip().lower()
    return email if _EMAIL_RE.match(email) else None


def slug(raw: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-") or "anonymous"


def demo_identity(header_value: str) -> Identity:
    """`X-Demo-User` accepts a bare name or an email address.

    An email is what makes the account claimable later, so prefer it when the
    caller has one. A bare name still works for judges scanning the QR code, it
    just cannot be linked to a future login.
    """
    raw = header_value.strip()
    if not raw:
        raise HTTPException(status_code=401, detail="X-Demo-User must not be empty")
    email = normalize_email(raw)
    return Identity(
        name=email or slug(raw),
        display_name=email.split("@")[0] if email else raw,
        email=email,
        auth0_sub=None,
        provider="demo",
    )


async def provision(db: AsyncIOMotorDatabase, identity: Identity) -> dict[str, Any]:
    """Find or create the user for this identity. Idempotent."""
    now = datetime.now(timezone.utc)

    if identity.auth0_sub:
        found = await db.users.find_one({"auth0_sub": identity.auth0_sub})
        if found is not None:
            return found

    # Never write a null into email or auth0_sub: both indexes are sparse
    # unique, and an explicit null counts as a value that a second user would
    # collide with.
    claim: dict[str, Any] = {"last_seen_at": now, "auth_provider": identity.provider}
    if identity.email:
        claim["email"] = identity.email
    if identity.auth0_sub:
        claim["auth0_sub"] = identity.auth0_sub

    if identity.email:
        linked = await db.users.find_one_and_update(
            {"email": identity.email},
            {"$set": claim},
            return_document=ReturnDocument.AFTER,
        )
        if linked is not None:
            return linked

    return await db.users.find_one_and_update(
        {"name": identity.name},
        {
            "$set": claim,
            "$setOnInsert": {
                "name": identity.name,
                "display_name": identity.display_name,
                "cash": STARTING_CASH,
                "risk_profile": DEFAULT_RISK_PROFILE,
                "created_at": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )


async def get_current_user(
    x_demo_user: str | None = Header(default=None, alias="X-Demo-User"),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Resolve the caller to a user document, creating it on first contact.

    When Auth0 lands, a bearer token is parsed into an `Identity` here and
    `provision` is unchanged. Nothing downstream branches on provider.

    `require_db` is awaited by hand rather than declared as `Depends`, because
    FastAPI resolves sub-dependencies before the function body: an
    unauthenticated request would get the 503 of a missing database instead of
    a 401, and would reach the database at all.
    """
    if not (settings.demo_auth and x_demo_user):
        raise HTTPException(
            status_code=401,
            detail="send X-Demo-User: <name or email> (DEMO_AUTH=1); Auth0 login is not wired yet",
        )
    identity = demo_identity(x_demo_user)
    db = await require_db()
    return await provision(db, identity)
