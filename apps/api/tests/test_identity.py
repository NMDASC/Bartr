"""Identity normalization and the email claim. Owner: Vir. See DECISIONS 008.

The property that matters: one person is one account, however they typed
themselves in, and an identity carrying an email inherits whatever was already
built under that address.
"""

from app.identity import Identity, claim, normalize, record
from app.store import MemoryStore


def test_email_is_lowercased_and_trimmed():
    i = normalize("  Vir@Example.COM ")
    assert i.uid == "vir@example.com"
    assert i.email == "vir@example.com"
    assert i.display_name == "vir"
    assert i.kind == "email"


def test_casing_does_not_split_one_person_into_two_accounts():
    assert normalize("A@b.com").uid == normalize("a@B.COM ").uid


def test_bare_name_has_no_email():
    i = normalize("judge 3")
    assert i.uid == "judge 3"
    assert i.email is None
    assert i.kind == "name"


def test_phone_is_normalized_to_e164():
    """The iMessage gateway sends the same sender several ways (decision 006)."""
    uids = {
        normalize("+14124754173").uid,
        normalize("14124754173").uid,
        normalize("(412) 475-4173").uid,
        normalize("412-475-4173").uid,
    }
    assert uids == {"+14124754173"}


def test_uid_is_length_capped():
    assert len(normalize("x" * 200).uid) == 40


def test_claim_is_a_noop_without_an_email():
    store = MemoryStore()
    i = normalize("judge 3")
    assert claim(store, i).uid == "judge 3"


def test_email_identity_claims_the_existing_account():
    """A phone user who recorded an email is found by a later email identity."""
    store = MemoryStore()
    store.put_user(
        {"id": "+14124754173", "cash": 41_500.0, "positions": {}, "email": "vir@example.com"}
    )

    resolved = claim(store, normalize("vir@example.com"))

    assert resolved.uid == "+14124754173"
    assert store.get_user(resolved.uid)["cash"] == 41_500.0


def test_claim_leaves_the_uid_alone_when_the_email_is_unknown():
    store = MemoryStore()
    assert claim(store, normalize("vir@example.com")).uid == "vir@example.com"


def test_record_annotates_an_existing_user():
    store = MemoryStore()
    store.put_user({"id": "vir@example.com", "cash": 100_000.0, "positions": {}})

    record(store, normalize("vir@example.com"))

    user = store.get_user("vir@example.com")
    assert user["email"] == "vir@example.com"
    assert user["display_name"] == "vir"
    assert user["identity_kind"] == "email"


def test_record_does_not_create_users():
    """Engine.user owns creation, so there is one place that grants cash."""
    store = MemoryStore()
    record(store, normalize("vir@example.com"))
    assert store.get_user("vir@example.com") is None


def test_record_never_writes_a_null_email():
    """A written null would occupy the sparse unique index and block the next judge."""
    store = MemoryStore()
    store.put_user({"id": "judge 3", "cash": 100_000.0, "positions": {}})
    record(store, normalize("judge 3"))
    assert "email" not in store.get_user("judge 3")


def test_two_nameless_judges_coexist():
    store = MemoryStore()
    for label in ("judge 3", "judge 4"):
        store.put_user({"id": label, "cash": 100_000.0, "positions": {}})
        record(store, normalize(label))
    assert store.find_user_by_email("nobody@example.com") is None
    assert len(store.users) == 2
