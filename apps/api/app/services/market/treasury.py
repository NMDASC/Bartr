"""Owner liquidity (Plan.md 8.4, decision 003). The platform never trades.

The Treasury account acts for the owner:
  * ask ladder: the float (30% of shares) offered across posterior quantiles P55..P80
  * buyback floor: a standing bid at posterior P20 for up to `floor_qty` shares

Both come straight from the valuation posterior, so an uncertain business has a wide
owner spread and a documented one has a tight one. Quotes are per share.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.services.discovery.valuation import Valuation

SHARES = 10_000
FLOAT_FRAC = 0.30
FLOOR_FRAC = 0.10       # owner will buy back up to 10% of shares at the floor
ASK_LEVELS = 5


@dataclass
class Quote:
    side: str
    price: float
    qty: float


def ask_ladder(v: Valuation, unsold: float | None = None) -> list[Quote]:
    unsold = SHARES * FLOAT_FRAC if unsold is None else unsold
    if unsold <= 0:
        return []
    qs = [0.55, 0.6125, 0.675, 0.7375, 0.80]
    per = round(unsold / ASK_LEVELS, 2)
    return [Quote("sell", round(v.quantile(q) / SHARES, 2), per) for q in qs]


def buyback_floor(v: Valuation) -> Quote:
    return Quote("buy", round(v.quantile(0.20) / SHARES, 2), SHARES * FLOOR_FRAC)


def opening_quotes(v: Valuation) -> list[Quote]:
    return [buyback_floor(v), *ask_ladder(v)]
