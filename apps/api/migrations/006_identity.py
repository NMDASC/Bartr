"""users: email and display_name, so a demo session can become a real account.

Adds to the shape from 001:

    users { ..., email, display_name }

`email` is sparse unique and normalized (trimmed, lowercased) by
`app/identity.py`. It is the claim key: a judge who identifies as
`vir@example.com` through DEMO_AUTH today and signs in with that address later
resolves to the same `_id`, so their cash, positions and orders carry over
instead of resetting. See docs/DECISIONS.md 006.

Sparse matters here. Judges who type a bare name have no email at all, and a
non sparse unique index would let exactly one of them exist.

`display_name` exists because `name` from 001 is an identity key and unique.
It cannot also be the label the UI renders: two judges called "vir" would
collide, and an email identity should not show as a raw address on screen.
Backfilled from `name` for the team rows 001 seeded.
"""


async def up(db):
    await db.users.create_index("email", unique=True, sparse=True)

    await db.users.update_many(
        {"display_name": {"$exists": False}},
        [{"$set": {"display_name": "$name"}}],
    )
