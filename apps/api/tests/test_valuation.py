import math
from app.services.discovery.valuation import Observables, value, calibrate
from app.services.market.treasury import opening_quotes
from app.services.market.kelly import kelly_fraction, size_portfolio


def test_documented_laundromat_is_tight_and_near_multiple():
    o = Observables(category="laundromat", state="OK", revenue=380_000, sde=140_000, rating=4.6, review_count=180, years_operating=12)
    v = value(o)
    assert 350_000 < v.v0 < 650_000
    assert v.sigma < 0.30


def test_stub_is_wide_and_near_base_rate():
    o = Observables(category="laundromat", state="OK")
    v = value(o)
    assert v.sigma >= 0.6
    assert 300_000 < v.v0 < 500_000


def test_disagreement_widens_sigma():
    agree = value(Observables(category="hvac", sde=250_000, llm_estimate=640_000, llm_confidence=0.7))
    disagree = value(Observables(category="hvac", sde=250_000, llm_estimate=2_500_000, llm_confidence=0.7))
    assert disagree.sigma > agree.sigma


def test_listing_dominates():
    o = Observables(category="auto_repair", asking_price=700_000, sde=150_000)
    v = value(o)
    assert abs(math.log(v.v0 / (700_000 * 0.88))) < 0.15


def test_treasury_quotes_bracket_median():
    v = value(Observables(category="laundromat", sde=140_000))
    qs = opening_quotes(v)
    floor = qs[0]; asks = qs[1:]
    mid = v.v0 / 10_000
    assert floor.side == "buy" and floor.price < mid
    assert all(a.side == "sell" and a.price >= mid for a in asks)
    assert asks == sorted(asks, key=lambda q: q.price)


def test_kelly_zero_at_fair_and_capped():
    assert kelly_fraction(45, 45, 0.3)[1] == 0
    assert kelly_fraction(40, 46, 0.3)[1] == 0.20
    port = size_portfolio([{"id": 1, "price": 40, "value": 46, "sigma": 0.3}, {"id": 2, "price": 44, "value": 46, "sigma": 0.6}], 100_000)
    assert port[0]["usd"] == 20_000 and 5_000 < port[1]["usd"] < 7_000


def test_observables_reject_nonpositive_revenue():
    try:
        Observables(category="laundromat", revenue=0)
        raise AssertionError("expected ValueError")
    except ValueError as e:
        assert "revenue" in str(e)


def test_calibrate_runs():
    cases = [(Observables(category="laundromat", sde=140_000, asking_price=520_000), 520_000),
             (Observables(category="laundromat", sde=90_000, asking_price=400_000), 400_000)]
    s = calibrate(cases)
    assert "income" in s and s["income"] >= 0
