"""The exchange: one market per company, plus orders, batches, trades, the audit log.

    markets   { _id == id, shares_outstanding, tick, last_price, ref_price,
                batch_interval_s, next_batch_at, band_pct,
                treasury: { floor_price, floor_qty, ask_ladder[] },
                belief: { mu, sigma }, halted }
    orders    { _id == id, market_id, user_id, side, qty, limit_price, status,
                filled_qty, created_at, cancelled_at, origin }
    batches   { _id == id, market_id, t, clearing_price, volume, imbalance,
                n_buy, n_sell, band_hit, ref_moved }
    trades    { _id == id, market_id, batch_id, qty, price, t }
    audit_log { t, actor, action, payload }

Positions are not here: they live inside the user document, per `store.py` and
migration 001.

`orders` on (market_id, status) is the hot read: the engine loads the open book
for every market on every tick. `t` is a float epoch from `time.time()`, so a
plain descending index gives newest first.

`audit_log` is append only and never updated, which is the whole point of it
for the Sandia angle, so it gets an index and no unique key.
"""


async def up(db):
    await db.markets.create_index("next_batch_at")
    await db.markets.create_index("halted")

    await db.orders.create_index([("market_id", 1), ("status", 1)])
    await db.orders.create_index([("user_id", 1), ("created_at", -1)])

    await db.batches.create_index([("market_id", 1), ("t", -1)])
    await db.trades.create_index([("market_id", 1), ("t", -1)])

    await db.audit_log.create_index([("t", -1)])
    await db.audit_log.create_index([("actor", 1), ("t", -1)])
