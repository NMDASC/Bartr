"""users.email: so a demo session can be claimed by a real login later.

`email` is sparse unique and normalized (trimmed, lowercased) by
`app/identity.py`. It is the claim key: an identity carrying an address
resolves to whichever user already owns it, so the cash, positions and orders
built under a demo session carry over instead of resetting. See DECISIONS 011.

Sparse matters. Judges who type a bare name and iMessage senders identified by
phone have no email at all, and a non sparse unique index would let exactly one
of them exist.

`display_name` needs no index. It is written by `identity.record` and read only
for rendering, because `_id` is the identity string and cannot double as a
label: an email identity should not show as a raw address on screen.
"""


async def up(db):
    await db.users.create_index("email", unique=True, sparse=True)

    await db.users.update_many(
        {"display_name": {"$exists": False}},
        [{"$set": {"display_name": "$_id"}}],
    )
