"""Exchange engine. Owners: Nico (book, auction, scheduler), Aditya (mm, kelly).

Interfaces frozen in hour 1 (Plan.md section 10), both pure functions:

    clear_batch(orders: list[Order], prev_price: Decimal) -> BatchResult   # Nico
    quote(belief: Belief, inventory: int, params: MMParams) -> list[Order] # Aditya

They meet only in the scheduler, which is Nico's. Aditya develops against a
fake in-memory book; Nico develops against random order flow.

Also expected here: create_market(company) -> market_id, called by Zhiyuan on
company upsert.
"""
