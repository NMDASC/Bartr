"""users: play money accounts, plus the four of us seeded so we can trade at hour 1.

    users { _id, auth0_sub, name, cash, risk_profile: {...}, created_at }

`name` is the identity used by DEMO_AUTH (the X-Demo-User header), so it is
unique. `auth0_sub` is sparse because demo users and bot traders never have one.
"""

from datetime import datetime, timezone

STARTING_CASH = 100_000
TEAM = ["vir", "nico", "aditya", "zhiyuan"]

DEFAULT_RISK_PROFILE = {
    "tolerance": 0.5,
    "horizon": "medium",
    "sectors": [],
    "states": [],
    "budget": STARTING_CASH,
}


async def up(db):
    await db.users.create_index("name", unique=True)
    await db.users.create_index("auth0_sub", unique=True, sparse=True)

    for name in TEAM:
        await db.users.update_one(
            {"name": name},
            {
                "$setOnInsert": {
                    "name": name,
                    "cash": STARTING_CASH,
                    "risk_profile": DEFAULT_RISK_PROFILE,
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
