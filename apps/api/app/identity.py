"""Who is calling. Owner: Vir. See docs/DECISIONS.md 011.

Auth0 is deliberately not wired. Demo auth (`X-Demo-User`) is the only real
path, and it is also the demo day path for judges, so it is the one that gets
exercised all night rather than a second class fallback.

This module only normalizes a header into a user id and records what it knows
about that person. It deliberately does not create users: `Engine.user`
already does that with the starting cash, and there must be one owner of that.

Three kinds of identity reach us, all of them just strings to the engine:

    vir@example.com   a claimable identity
    +14124754173      iMessage, per decision 006
    judge 3           a judge at the expo table

Normalizing matters because the same person must not become two accounts by
typing `Vir@Example.com` once and `vir@example.com` later, and because an
iMessage sender arrives as `+1 (412) 475-4173` or `14124754173` depending on
the gateway.

The claim: when an identity carries an email we record it on the user document,
and a later identity with that same email resolves to the existing user id. So
a demo session becomes a real account without rewriting its orders, positions
or trades. This is ready rather than active, because the bearer path cannot see
an email yet; wiring Auth0 means passing the verified email into `Identity`
here and nothing else changes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, replace

MAX_UID = 40

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^\+?[0-9(][0-9 ()\-.]{6,20}$")


@dataclass(frozen=True)
class Identity:
    uid: str
    display_name: str
    email: str | None
    kind: str  # "email" | "phone" | "name" | "bearer"


def _digits(raw: str) -> str:
    return re.sub(r"[^0-9]", "", raw)


def normalize(raw: str) -> Identity:
    """Turn a raw `X-Demo-User` value into a stable identity."""
    value = raw.strip()

    email = value.lower()
    if _EMAIL_RE.match(email):
        return Identity(
            uid=email[:MAX_UID], display_name=email.split("@")[0], email=email, kind="email"
        )

    if _PHONE_RE.match(value):
        digits = _digits(value)
        # Assume North America when a 10 digit number arrives without a country
        # code, which is what the iMessage gateway sends for local contacts.
        if len(digits) == 10:
            digits = "1" + digits
        e164 = "+" + digits
        return Identity(uid=e164, display_name=e164, email=None, kind="phone")

    return Identity(uid=value[:MAX_UID], display_name=value, email=None, kind="name")


def claim(store, identity: Identity) -> Identity:
    """Point an identity at the user who already owns its email, if any."""
    if not identity.email:
        return identity
    existing = store.find_user_by_email(identity.email)
    if existing and existing["id"] != identity.uid:
        return replace(identity, uid=existing["id"])
    return identity


def record(store, identity: Identity) -> None:
    """Annotate the user document with what this identity knows. Idempotent.

    Does nothing until the user exists, which `Engine.user` handles. Only
    writes when something actually changed, so this is not a write per request.
    """
    user = store.get_user(identity.uid)
    if user is None:
        return

    patch = {}
    if identity.email and user.get("email") != identity.email:
        patch["email"] = identity.email
    if not user.get("display_name"):
        patch["display_name"] = identity.display_name
    if user.get("identity_kind") != identity.kind:
        patch["identity_kind"] = identity.kind

    if patch:
        user.update(patch)
        store.put_user(user)
