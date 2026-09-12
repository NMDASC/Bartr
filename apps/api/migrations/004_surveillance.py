"""flags: what the compliance rules and the two model reviewers raise on the tape.

    flags { _id, market_id, batch_id, rule, severity, subjects[], explanation,
            reviewer: "rules"|"grok"|"k2", t }

This is the 2:35 mark of the demo, so it ships in the first pass. `audit_log`,
`options`, and `acquisitions` from the data model are deliberately not here:
they are cut candidates, and Mongo will create them on first insert if we do
build them.
"""


async def up(db):
    await db.flags.create_index([("t", -1)])
    await db.flags.create_index([("market_id", 1), ("t", -1)])
