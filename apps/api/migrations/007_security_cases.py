"""Persist investigations independently of the rolling market tape."""
async def up(db):
    await db.security_cases.create_index([("last_seen", -1)])
    await db.security_cases.create_index([("status", 1), ("flag.market_id", 1)])
    await db.audit_log.create_index([("action", 1), ("t", -1)])
