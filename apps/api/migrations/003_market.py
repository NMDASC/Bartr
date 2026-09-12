"""The exchange: one market per company, plus orders, batches, trades, positions.

    markets   { _id: company_id, shares_outstanding, tick, last_price, ref_price,
                batch_interval_s, next_batch_at, band_pct,
                mm: { inventory, cash, gamma, k, sigma, max_depth }, halted }
    orders    { _id, market_id, user_id, side, qty, limit_price, status,
                filled_qty, created_at, cancelled_at, origin }
    batches   { _id, market_id, t, clearing_price, volume, imbalance,
                n_buy, n_sell, book_snapshot: { bids[], asks[] } }
    trades    { _id, market_id, batch_id, buyer_id, seller_id, qty, price, t }
    positions { _id, user_id, market_id, qty, avg_cost }

The scheduler polls `next_batch_at` to find markets due to clear, so that index
carries the hot path and is worth having from the first run rather than after we
notice the demo stuttering.

`positions` is unique on (user_id, market_id): one row per holding. Without it a
concurrent fill can quietly create a second position document and the portfolio
page silently under-reports. Upsert against that pair, never insert.
"""


async def up(db):
    await db.markets.create_index("next_batch_at")
    await db.markets.create_index("halted")

    await db.orders.create_index([("market_id", 1), ("status", 1)])
    await db.orders.create_index([("user_id", 1), ("created_at", -1)])

    await db.batches.create_index([("market_id", 1), ("t", -1)])
    await db.trades.create_index([("market_id", 1), ("t", -1)])

    await db.positions.create_index([("user_id", 1), ("market_id", 1)], unique=True)
