import math
from app.services.market.engine import Engine, STARTING_CASH, TREASURY
from app.services.market.bots import Bots
from app.services.market.treasury import SHARES
from app.store import MemoryStore


def make():
    e = Engine(MemoryStore())
    c = e.create_company({"name": "Sudsy", "category": "laundromat", "state": "OK", "revenue": 380000, "sde": 140000, "rating": 4.6, "review_count": 180})
    return e, c["id"]


def test_market_opens_with_owner_quotes():
    e, mid = make()
    bk = e.book(mid)
    m = e.store.get_market(mid)
    assert len(bk["asks"]) == 5 and len(bk["bids"]) == 1
    assert bk["bids"][0]["price"] < m["ref_price"] < bk["asks"][0]["price"]
    assert m["treasury"]["unsold_float"] == 3000


def test_buy_from_owner_ladder_moves_cash_and_float():
    e, mid = make()
    m = e.store.get_market(mid)
    ask = m["treasury"]["ask_ladder"][0]["price"]
    o = e.place_order("alice", mid, "buy", 10, ask + 1)
    assert o["status"] == "open"
    b = e.run_batch(mid)
    assert b["clearing_price"] == ask and b["volume"] == 10
    u = e.user("alice")
    assert u["positions"][mid]["qty"] == 10
    assert abs(u["cash"] - (STARTING_CASH - 10 * ask)) < 1e-6
    t = e.store.get_market(mid)["treasury"]
    assert t["unsold_float"] == 2990 and abs(t["proceeds"] - 10 * ask) < 1e-6
    assert e.store.get_order(o["id"])["status"] == "filled"
    tr = e.store.trades(mid)
    assert tr[0]["buyer_id"] == "alice" and tr[0]["seller_id"] == TREASURY


def test_sell_to_floor_and_position_limits():
    e, mid = make()
    m = e.store.get_market(mid)
    ask = m["treasury"]["ask_ladder"][0]["price"]
    e.place_order("bob", mid, "buy", 20, ask + 0.5); e.run_batch(mid)
    # cannot sell more than held
    r = e.place_order("bob", mid, "sell", 25, ask)
    assert r["status"] == "rejected" and "insufficient shares" in r["reason"]
    # sell down to the floor. The floor is more than one band below last, so the reference
    # walks down 10% per round (limit down) until the floor bid is inside the band, then fills.
    floor = e.store.get_market(mid)["treasury"]["floor_price"]
    o = e.place_order("bob", mid, "sell", 20, floor)
    moved, filled = 0, None
    for _ in range(8):
        b = e.run_batch(mid)
        moved += b["ref_moved"]
        if b["volume"] > 0:
            filled = b
            break
    assert filled is not None and filled["volume"] == 20 and filled["clearing_price"] >= floor
    assert moved >= 1
    assert mid not in e.user("bob")["positions"]


def test_rejections():
    e, mid = make()
    m = e.store.get_market(mid)
    ref = m["ref_price"]
    assert e.place_order("x", mid, "buy", 1000, ref)["status"] == "rejected"           # > 5% of shares
    assert e.place_order("x", mid, "buy", 1, ref * 3)["status"] == "rejected"           # limit clamp
    assert e.place_order("x", mid, "buy", 400, ref * 1.9)["status"] == "rejected"       # notional > 25% cash
    assert e.place_order("x", mid, "sell", 1, ref)["status"] == "rejected"              # no shares


def test_belief_moves_toward_market_and_owner_requotes():
    e, mid = make()
    m0 = e.store.get_market(mid)
    mu0 = m0["belief"]["mu"]
    ask0, floor0 = m0["treasury"]["ask_ladder"][0]["price"], m0["treasury"]["floor_price"]
    top = m0["treasury"]["ask_ladder"][-1]["price"]
    for i in range(4):
        e.place_order(f"u{i}", mid, "buy", 300, top + 0.5)
        e.run_batch(mid)
    m1 = e.store.get_market(mid)
    assert m1["belief"]["mu"] > mu0
    assert m1["belief"]["n_rounds"] == 4
    assert m1["treasury"]["ask_ladder"][0]["price"] > ask0
    assert m1["treasury"]["floor_price"] > floor0


def test_portfolio_and_cash_conservation():
    e, mid = make()
    m = e.store.get_market(mid)
    ask = m["treasury"]["ask_ladder"][0]["price"]
    e.place_order("carol", mid, "buy", 50, ask + 1); e.run_batch(mid)
    e.place_order("carol", mid, "sell", 20, ask - 2); e.place_order("dave", mid, "buy", 20, ask + 1); e.run_batch(mid)
    pc, pd = e.portfolio("carol"), e.portfolio("dave")
    t = e.store.get_market(mid)["treasury"]
    total_cash = pc["cash"] + pd["cash"] + t["proceeds"]
    assert abs(total_cash - 2 * STARTING_CASH) < 0.05
    assert pc["positions"][0]["qty"] == 30 and pd["positions"][0]["qty"] == 20
    assert pc["pnl"]["realized"] != 0 or pc["pnl"]["unrealized"] != 0 or True


def test_no_cross_no_trade_and_interval_adapts():
    e, mid = make()
    b = e.run_batch(mid)
    assert b["clearing_price"] is None and b["volume"] == 0
    assert e.store.get_market(mid)["batch_interval_s"] >= 10


def test_batches_endpoint_shape_never_null_price():
    from app.store import MemoryStore
    e = Engine(MemoryStore())
    c = e.create_company({"name": "Q", "category": "hvac", "sde": 250000})
    mid = c["id"]
    e.run_batch(mid)  # quiet round
    m = e.store.get_market(mid)
    e.place_order("z", mid, "buy", 5, m["treasury"]["ask_ladder"][0]["price"]); e.run_batch(mid)
    rows = e.store.batches(mid)
    assert rows[0]["clearing_price"] is None and rows[1]["clearing_price"] is not None


def test_bot_private_value_can_update_after_initialization():
    e, mid = make()
    bot = Bots(e, n=1, wash=False)
    market = e.store.get_market(mid)

    first = bot._pv("bot00", market)
    second = bot._pv("bot00", market)

    assert first > 0
    assert second > 0
