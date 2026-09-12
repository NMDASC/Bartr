from app.services.market.auction import Order, clear, clearing_price, next_interval


def book():
    return [
        Order("a", "alice", "buy", 10, 47, 1),
        Order("b", "bob", "buy", 5, 45, 2),
        Order("c", "carol", "buy", 20, 44, 3),
        Order("h1", "treasury", "buy", 6, 43, 4),
        Order("d", "dave", "sell", 5, 43, 5),
        Order("e", "erin", "sell", 8, 45, 6),
        Order("h2", "treasury", "sell", 6, 46, 7),
        Order("f", "frank", "sell", 10, 48, 8),
    ]


def test_worked_example_clears_at_45_with_13_shares():
    r = clear(book(), last_price=None)
    assert r.price == 45
    assert r.volume == 13
    by = {f.order_id: f for f in r.fills}
    assert by["d"].qty == 5 and by["e"].qty == 8
    assert abs(by["a"].qty - 8.67) < 0.011 and abs(by["b"].qty - 4.33) < 0.011
    assert abs(by["a"].qty + by["b"].qty - 13) < 1e-9
    assert "c" not in by and "f" not in by


def test_no_cross_means_no_trade():
    r = clear([Order("x", "u1", "buy", 5, 40, 1), Order("y", "u2", "sell", 5, 50, 2)], None)
    assert r.price is None and r.volume == 0


def test_whale_gets_price_improvement_not_a_spike():
    # one aggressive buyer, one seller at 44: clears at 44, not at the whale's 90
    orders = [Order("x", "whale", "buy", 100, 90, 1), Order("y", "u2", "sell", 10, 44, 2)]
    r = clear(orders, last_price=45, band=0.10)
    assert not r.band_hit and r.price == 44 and r.volume == 10


def test_band_clamps_spike_and_rations():
    # sellers at 44 and 60, whale bids 90: unconstrained optimum is 60 (20 shares);
    # band from last 45 clamps to 49.5, only the 44 seller trades, excess demand carries over
    orders = [Order("x", "whale", "buy", 100, 90, 1), Order("y", "u2", "sell", 10, 44, 2), Order("z", "u3", "sell", 10, 60, 3)]
    r = clear(orders, last_price=45, band=0.10)
    assert r.band_hit and r.price == 49.5 and r.volume == 10
    assert {f.order_id for f in r.fills} == {"x", "y"}


def test_band_with_no_supply_inside_it_trades_nothing():
    orders = [Order("x", "whale", "buy", 100, 90, 1), Order("z", "u3", "sell", 10, 60, 3)]
    r = clear(orders, last_price=45, band=0.10)
    assert r.band_hit and r.volume == 0


def test_self_trade_prevented():
    orders = [Order("x", "u1", "buy", 5, 46, 1), Order("y", "u1", "sell", 5, 44, 2), Order("z", "u2", "sell", 5, 45, 3)]
    r = clear(orders, None)
    ids = {f.order_id for f in r.fills}
    assert "y" not in ids and {"x", "z"} <= ids


def test_tiebreak_closest_to_last():
    # equal volume at 44 and 46, pick the one nearer last price 45.9
    orders = [Order("x", "u1", "buy", 10, 46, 1), Order("y", "u2", "sell", 10, 44, 2)]
    p, _, _ = clearing_price(orders, last_price=45.9)
    assert p == 46


def test_interval_grows_when_sparse():
    assert next_interval(40) == 10
    assert next_interval(2) == 60


def test_opening_trade_anchors_on_reference_not_midpoint():
    orders = [Order("x", "u1", "buy", 10, 55.42, 1), Order("y", "treasury", "sell", 600, 54.42, 2)]
    r = clear(orders, last_price=None, anchor=52.59)
    assert r.price == 54.42
    r2 = clear(orders, last_price=None)          # no anchor at all: midpoint
    assert r2.price == 54.92
