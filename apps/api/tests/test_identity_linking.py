"""Demo sessions must survive becoming real accounts. Owner: Vir.

See docs/DECISIONS.md 002. The property under test: a demo user who later signs
in with the same email keeps the same `users._id`, so their cash, positions and
orders carry over instead of resetting.

Runs against a small in-memory stand-in for the `users` collection rather than
a live Mongo, so it stays in the default `uv run pytest` path.
"""

from typing import Any

import pytest

from app.identity import Identity, provision


class FakeUsers:
    """Just enough of a Mongo collection for provision(): the two lookups it
    does, plus $addToSet / $set / insert."""

    def __init__(self) -> None:
        self.docs: list[dict[str, Any]] = []
        self._next_id = 1

    async def find_one(self, query: dict[str, Any]) -> dict[str, Any] | None:
        for doc in self.docs:
            if self._matches(doc, query):
                return doc
        return None

    async def find_one_and_update(
        self, query: dict[str, Any], update: dict[str, Any], **_: Any
    ) -> dict[str, Any] | None:
        doc = await self.find_one(query)
        if doc is None:
            return None
        for field, value in update.get("$addToSet", {}).items():
            if value not in doc[field]:
                doc[field].append(value)
        doc.update(update.get("$set", {}))
        return doc

    async def insert_one(self, doc: dict[str, Any]) -> Any:
        # Stored by reference, so a document handed back by provision() is a
        # live view of the stored row. That lets a test mutate `cash` to stand
        # in for a session of trading without a separate update path.
        doc["_id"] = self._next_id
        self._next_id += 1
        self.docs.append(doc)
        return type("Result", (), {"inserted_id": doc["_id"]})()

    @staticmethod
    def _matches(doc: dict[str, Any], query: dict[str, Any]) -> bool:
        for field, wanted in query.items():
            actual = doc.get(field)
            # Mongo matches a scalar against any element of an array field.
            if isinstance(actual, list):
                if wanted not in actual:
                    return False
            elif actual != wanted:
                return False
        return True


class FakeDB:
    def __init__(self) -> None:
        self.users = FakeUsers()


@pytest.fixture
def db() -> FakeDB:
    return FakeDB()


def demo(email: str) -> Identity:
    return Identity(subject=f"demo|{email}", provider="demo", email=email, name=email.split("@")[0])


def auth0(email: str, sub: str = "auth0|65f3a1") -> Identity:
    return Identity(subject=sub, provider="auth0", email=email, name="Vir")


async def test_first_contact_creates_user_with_starting_cash(db):
    user = await provision(db, demo("vir@example.com"))
    assert user["cash"] == 100_000.0
    assert user["auth_subs"] == ["demo|vir@example.com"]
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

    signed_in = await provision(db, auth0("vir@example.com"))

    assert signed_in["_id"] == demo_user["_id"]
    assert signed_in["cash"] == 41_500.0
    assert signed_in["auth_provider"] == "auth0"
    assert set(signed_in["auth_subs"]) == {"demo|vir@example.com", "auth0|65f3a1"}
    assert len(db.users.docs) == 1


async def test_demo_header_still_works_after_signin(db):
    """Both subjects stay linked, so the two doors do not fight over the user."""
    await provision(db, demo("vir@example.com"))
    await provision(db, auth0("vir@example.com"))
    back_via_demo = await provision(db, demo("vir@example.com"))
    assert len(db.users.docs) == 1
    assert back_via_demo["auth_subs"] == ["demo|vir@example.com", "auth0|65f3a1"]


async def test_different_emails_are_different_users(db):
    a = await provision(db, demo("vir@example.com"))
    b = await provision(db, demo("nico@example.com"))
    assert a["_id"] != b["_id"]
    assert len(db.users.docs) == 2


async def test_nameless_judges_are_separate_accounts(db):
    """Bare names cannot be claimed later, but must not collide with each other."""
    a = await provision(db, Identity("demo|judge-3", "demo", None, "judge 3"))
    b = await provision(db, Identity("demo|judge-4", "demo", None, "judge 4"))
    assert a["_id"] != b["_id"]
    assert a["email"] is None
