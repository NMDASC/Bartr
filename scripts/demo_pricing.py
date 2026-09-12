"""Run the pricing ensemble and the auction on hand entered examples. No keys needed.

    python scripts/demo_pricing.py
"""
import os, sys, random
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "api"))

from app.services.discovery.valuation import Observables, value
from app.services.market.treasury import opening_quotes, SHARES
from app.services.market.auction import Order, clear
from app.services.market.kelly import size_portfolio

CASES = {
    "Documented laundromat, Tulsa OK (SDE from a listing page)":
        Observables(category="laundromat", state="OK", revenue=380_000, sde=140_000, rating=4.6, review_count=180, years_operating=12, llm_estimate=520_000, llm_confidence=0.7),
    "Same laundromat, actually listed on BizBuySell at $575k":
        Observables(category="laundromat", state="OK", revenue=380_000, sde=140_000, asking_price=575_000, rating=4.6, review_count=180, years_operating=12),
    "Stub: a laundromat that is only a Google Places pin":
        Observables(category="laundromat", state="OK", rating=4.1, review_count=23),
    "Car wash, TX, employees known, no financials, Grok and K2 disagree":
        Observables(category="car_wash", state="TX", employees=9, rating=4.7, review_count=640, llm_estimate=1_900_000, llm2_estimate=900_000, llm_confidence=0.5),
    "Machine shop, OH, revenue only, owner operated":
        Observables(category="machine_shop", state="OH", revenue=1_400_000, employees=8, owner_operated=True, years_operating=22),
}

def show(name, o):
    v = value(o)
    print(f"\n== {name}")
    for e in v.estimates:
        print(f"   {e.name:<10} ${e.value:>12,.0f}  sigma {e.sigma:.2f}   {e.note}")
    print(f"   -> posterior median ${v.v0:,.0f}   sigma {v.sigma:.2f}   P20 ${v.low:,.0f}  P80 ${v.high:,.0f}   disagreement {v.disagreement:.2f}")
    qs = opening_quotes(v)
    print(f"   per share: {v.v0/SHARES:.2f}.  Owner floor bid {qs[0].price} x {qs[0].qty:.0f};  ask ladder " + ", ".join(f"{q.price}x{q.qty:.0f}" for q in qs[1:]))
    return v

vals = {n: show(n, o) for n, o in CASES.items()}

print("\n\n== Auction simulation: documented laundromat, 6 rounds, 8 bot players with private valuations")
random.seed(7)
v = vals["Documented laundromat, Tulsa OK (SDE from a listing page)"]
p_model = v.v0 / SHARES
quotes = opening_quotes(v)
seq = 0
last = None
holdings = {f"bot{i}": 0.0 for i in range(8)}
private = {b: p_model * (2.718 ** random.gauss(0, v.sigma * 0.7)) for b in holdings}
unsold = quotes[1].qty * len(quotes[1:])
for rnd in range(1, 7):
    orders = []
    # owner: floor + ladder
    orders.append(Order("floor", "treasury", "buy", quotes[0].qty, quotes[0].price, seq := seq + 1, "treasury"))
    for i, q in enumerate(quotes[1:]):
        if q.qty > 0:
            orders.append(Order(f"ask{i}", "treasury", "sell", q.qty, q.price, seq := seq + 1, "treasury"))
    # bots: half Kelly around their private value vs last/model price
    ref = last or p_model
    for b, pv in private.items():
        port = size_portfolio([{"id": b, "price": ref, "value": pv, "sigma": v.sigma}], 100_000)[0]
        if port["usd"] > 0:
            qty = round(port["usd"] / ref * 0.3, 2)
            orders.append(Order(f"{b}-{rnd}", b, "buy", qty, round(pv * 1.02, 2), seq := seq + 1, "bot"))
        elif holdings[b] > 0 and pv < ref * 0.97:
            orders.append(Order(f"{b}-{rnd}", b, "sell", round(holdings[b] * 0.5, 2), round(pv * 0.98, 2), seq := seq + 1, "bot"))
    r = clear(orders, last, 0.10)
    if r.price is not None and r.volume > 0:
        last = r.price
        for f in r.fills:
            if f.user_id in holdings:
                holdings[f.user_id] += f.qty if f.side == "buy" else -f.qty
            elif f.side == "sell":
                # reduce the owner ladder level that filled
                for i, q in enumerate(quotes[1:]):
                    if f.order_id == f"ask{i}":
                        q.qty = round(q.qty - f.qty, 2)
    print(f"   round {rnd}: n_orders {len(orders):>2}  p* {r.price}  volume {r.volume:>7}  demand {r.demand:>8.2f} supply {r.supply:>8.2f}  band_hit {r.band_hit}")
print(f"   model price {p_model:.2f}, last clearing {last}, owner float left {sum(q.qty for q in quotes[1:]):.0f} of {unsold:.0f}")
print("   bot private values:", ", ".join(f"{b}={pv:.1f}" for b, pv in private.items()))
