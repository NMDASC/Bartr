"""Demo sessions must survive becoming real accounts. Owner: Vir.

See docs/DECISIONS.md 006. The property under test: a demo user who later signs
in with the same email keeps the same `users._id`, so their cash, positions and
orders carry over instead of resetting.

Runs against a small in-memory stand-in for the `users` collection rather than
a live mongo, so it stays in the default `uv run pytest` path.
"""

from typing import Any

import pytest

from app.identity import Identity, provision


class FakeUsers:
    """Just enough of a mongo collection for provision(): the lookups it does,
    plus $set, $setOnInsert and upsert."""

    def __init__(self) -> None:
        self.docs: list[dict[str, Any]] = []
        self._next_id = 1

    async def find_one(self, query: dict[str, Any]) -> dict[str, Any] | None:
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None

    async def find_one_and_update(
        self,
        query: dict[str, Any],
        update: dict[str, Any],
        *,
        upsert: bool = False,
        **_: Any,
    ) -> dict[str, Any] | None:
        doc = await self.find_one(query)
        if doc is None:
            if not upsert:
                return None
            # Stored by reference, so the document handed back is a live view of
            # the stored row. That lets a test mutate `cash` to stand in for a
            # session of trading without a separate update path.
            doc = {"_id": self._next_id}
            self._next_id += 1
            doc.update(update.get("$setOnInsert", {}))
            self.docs.append(doc)
        doc.update(update.get("$set", {}))
        return doc


class FakeDB:
    def __init__(self) -> None:
        self.users = FakeUsers()


@pytest.fixture
def db() -> FakeDB:
    return FakeDB()


def demo(email: str) -> Identity:
    return Identity(
        name=email,
        display_name=email.split("@")[0],
        email=email,
        auth0_sub=None,
        provider="demo",
    )


def judge(label: str) -> Identity:
    return Identity(
        name=label, display_name=label, email=None, auth0_sub=None, provider="demo"
    )


def signin(email: str, sub: str = "auth0|65f3a1") -> Identity:
    return Identity(
        name=email, display_name="Vir", email=email, auth0_sub=sub, provider="auth0"
    )


async def test_first_contact_creates_user_with_starting_cash(db):
    user = await provision(db, demo("vir@example.com"))
    assert user["cash"] == 100_000
    assert user["name"] == "vir@example.com"
    assert user["display_name"] == "vir"
    assert len(db.users.docs) == 1


async def test_repeat_demo_request_is_idempotent(db):
    first = await provision(db, demo("vir@example.com"))
    second = await provision(db, demo("vir@example.com"))
    assert first["_id"] == second["_id"]
    assert len(db.users.docs) == 1


async def test_demo_cash_is_not_reset_on_return(db):
    user = await provision(db, demo("vir@example.com"))
    user["cash"] = 41_500.0  # stand-in for a session of trading
    again = await provision(db, demo("vir@example.com"))
    assert again["cash"] == 41_500.0


async def test_later_signin_claims_the_demo_account(db):
    """The whole point: same _id, so orders and positions carry over."""
    demo_user = await provision(db, demo("vir@example.com"))
    demo_user["cash"] = 41_500.0

    signed_in = await provision(db, signin("vir@example.com"))

    assert signed_in["_id"] == demo_user["_id"]
    assert signed_in["cash"] == 41_500.0
    assert signed_in["auth_provider"] == "auth0"
    assert signed_in["auth0_sub"] == "auth0|65f3a1"
    assert len(db.users.docs) == 1


async def test_signed_in_user_is_found_by_sub_not_just_email(db):
    await provision(db, demo("vir@example.com"))
    first = await provision(db, signin("vir@example.com"))
    again = await provision(db, signin("vir@example.com"))
    assert first["_id"] == again["_id"]
    assert len(db.users.docs) == 1


async def test_demo_header_still_works_after_signin(db):
    """Both doors stay open, so they do not fight over the user."""
    await provision(db, demo("vir@example.com"))
    await provision(db, signin("vir@example.com"))
    back_via_demo = await provision(db, demo("vir@example.com"))
    assert len(db.users.docs) == 1
    assert back_via_demo["auth0_sub"] == "auth0|65f3a1"


async def test_null_email_is_never_written(db):
    """A written null would occupy the sparse unique index and block the next judge."""
    user = await provision(db, judge("judge-3"))
    assert "email" not in user
    assert "auth0_sub" not in user


async def test_nameless_judges_are_separate_accounts(db):
    a = await provision(db, judge("judge-3"))
    b = await provision(db, judge("judge-4"))
    assert a["_id"] != b["_id"]
    assert len(db.users.docs) == 2


async def test_team_row_seeded_by_migration_is_adopted_not_duplicated(db):
    """001_users.py seeds name-only rows for the four of us."""
    db.users.docs.append(
        {"_id": 99, "name": "vir", "cash": 100_000, "risk_profile": {}}
    )
    user = await provision(db, judge("vir"))
    assert user["_id"] == 99
    assert len(db.users.docs) == 1
