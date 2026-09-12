"""Half Kelly position sizing for players and bots (Plan.md 8.6). Never for house accounts."""
from __future__ import annotations

import math


def kelly_fraction(price: float, value: float, sigma: float, multiplier: float = 0.5, cap: float = 0.20) -> tuple[float, float]:
    """Returns (edge mu, fraction of bankroll). mu = ln(value/price); f* = mu / sigma^2."""
    if price <= 0 or value <= 0 or sigma <= 0:
        return 0.0, 0.0
    mu = math.log(value / price)
    f = multiplier * mu / (sigma ** 2)
    return mu, max(0.0, min(cap, f))


def size_portfolio(candidates: list[dict], bankroll: float, multiplier: float = 0.5, cap: float = 0.20, budget_frac: float = 0.80) -> list[dict]:
    """candidates: [{id, price, value, sigma}], returns with mu, f, usd added and total scaled to budget."""
    out = []
    for c in candidates:
        mu, f = kelly_fraction(c["price"], c["value"], c["sigma"], multiplier, cap)
        out.append({**c, "mu": mu, "f": f})
    total = sum(c["f"] for c in out)
    scale = min(1.0, budget_frac / total) if total > 0 else 0.0
    for c in out:
        c["f"] = c["f"] * scale
        c["usd"] = round(c["f"] * bankroll, 2)
    return sorted(out, key=lambda c: -c["f"])
