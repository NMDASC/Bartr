"""users: play money accounts, plus the four of us seeded so we can trade at hour 1.

    users { _id == id, cash, positions: { mid: {qty, avg_cost} },
            email?, display_name?, identity_kind?, created_at }

The shape follows `app/store.py::Store`, which is what the engine actually
reads and writes, rather than the original section 6 sketch. Two consequences:

  * `id` is the demo identity string itself (a name, an email, or an E.164
    phone), normalized by `app/identity.py`. It is the `_id`, so uniqueness is
    free and `put_user` is an idempotent replace. There is no separate `name`
    field and no index on one.
  * positions live inside the user document, so there is no `positions`
    collection to index. A holding is only ever touched together with the cash
    it was paid from, which is also the only way to keep the two consistent
    without a transaction.

Seeding is a convenience, not a requirement: `Engine.user` creates accounts on
first contact with the starting cash. These rows exist so the four of us can
place orders immediately and so `migrate.py reset` gives a known state.
"""

import time

STARTING_CASH = 100_000.0  # mirrors engine.STARTING_CASH
TEAM = ["vir", "nico", "aditya", "zhiyuan"]


async def up(db):
    for name in TEAM:
        await db.users.update_one(
            {"_id": name},
            {
                "$setOnInsert": {
                    "id": name,
                    "cash": STARTING_CASH,
                    "positions": {},
                    "display_name": name,
                    "identity_kind": "name",
                    "created_at": time.time(),
                }
            },
            upsert=True,
        )
