"""Frequent batch auction: uniform price clearing that maximizes executed volume.

Pure functions, no I/O. The scheduler loads open orders, calls clear(), persists fills.

Algorithm (Plan.md 8.3):
  demand(p) = sum of buy qty with limit >= p
  supply(p) = sum of sell qty with limit <= p
  p* = argmax_p min(demand(p), supply(p)) over the set of limit prices in the book
  ties: smallest |demand - supply|, then closest to last_price, then midpoint
  fills: all buys with limit >= p* and all sells with limit <= p* trade at p*;
         the short side fills fully, the long side is rationed pro rata (time priority
         breaks the final rounding).
  band:  p* is clamped to [last*(1-band), last*(1+band)] when last_price is known.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Order:
    id: str
    user_id: str
    side: str          # "buy" | "sell"
    qty: float         # remaining quantity
    limit: float
    seq: int = 0       # arrival order, for time priority
    origin: str = "user"


@dataclass
class Fill:
    order_id: str
    user_id: str
    side: str
    qty: float
    price: float


@dataclass
class BatchResult:
    price: float | None
    volume: float
    fills: list[Fill] = field(default_factory=list)
    demand: float = 0.0
    supply: float = 0.0
    band_hit: bool = False
    candidates: list[tuple[float, float, float]] = field(default_factory=list)  # (p, demand, supply)


def _curves(orders: list[Order], p: float) -> tuple[float, float]:
    d = sum(o.qty for o in orders if o.side == "buy" and o.limit >= p)
    s = sum(o.qty for o in orders if o.side == "sell" and o.limit <= p)
    return d, s


def self_trade_filter(orders: list[Order]) -> list[Order]:
    """Drop the later of any user's crossing buy/sell pair (Plan.md 8.5)."""
    by_user: dict[str, list[Order]] = {}
    for o in orders:
        by_user.setdefault(o.user_id, []).append(o)
    drop: set[str] = set()
    for os_ in by_user.values():
        buys = [o for o in os_ if o.side == "buy"]
        sells = [o for o in os_ if o.side == "sell"]
        for b in buys:
            for s in sells:
                if b.limit >= s.limit:
                    drop.add(max(b, s, key=lambda o: o.seq).id)
    return [o for o in orders if o.id not in drop]


def clearing_price(orders: list[Order], last_price: float | None, band: float = 0.10) -> tuple[float | None, list, bool]:
    prices = sorted({o.limit for o in orders})
    if not prices:
        return None, [], False
    cands = [(p, *_curves(orders, p)) for p in prices]
    best_vol = max(min(d, s) for _, d, s in cands)
    if best_vol <= 0:
        return None, cands, False
    tied = [(p, d, s) for p, d, s in cands if min(d, s) == best_vol]
    if len(tied) > 1:
        min_imb = min(abs(d - s) for _, d, s in tied)
        tied = [(p, d, s) for p, d, s in tied if abs(d - s) == min_imb]
    if len(tied) > 1 and last_price is not None:
        closest = min(abs(p - last_price) for p, _, _ in tied)
        tied = [(p, d, s) for p, d, s in tied if abs(p - last_price) == closest]
    p_star = tied[0][0] if len(tied) == 1 else (tied[0][0] + tied[-1][0]) / 2
    band_hit = False
    if last_price is not None:
        lo, hi = last_price * (1 - band), last_price * (1 + band)
        if p_star > hi:
            p_star, band_hit = hi, True
        elif p_star < lo:
            p_star, band_hit = lo, True
    return round(p_star, 2), cands, band_hit


def clear(orders: list[Order], last_price: float | None, band: float = 0.10) -> BatchResult:
    orders = self_trade_filter(orders)
    p, cands, band_hit = clearing_price(orders, last_price, band)
    if p is None:
        return BatchResult(price=None, volume=0.0, candidates=cands)
    buys = sorted([o for o in orders if o.side == "buy" and o.limit >= p], key=lambda o: o.seq)
    sells = sorted([o for o in orders if o.side == "sell" and o.limit <= p], key=lambda o: o.seq)
    d, s = sum(o.qty for o in buys), sum(o.qty for o in sells)
    vol = min(d, s)
    if vol <= 0:
        return BatchResult(price=p, volume=0.0, demand=d, supply=s, band_hit=band_hit, candidates=cands)
    fills: list[Fill] = []
    for side_orders, side_total in ((buys, d), (sells, s)):
        if side_total <= vol + 1e-12:
            for o in side_orders:
                fills.append(Fill(o.id, o.user_id, o.side, round(o.qty, 2), p))
        else:
            # pro rata, rounded to 0.01, remainder by time priority
            ratio = vol / side_total
            alloc = [round(o.qty * ratio, 2) for o in side_orders]
            rem = round(vol - sum(alloc), 2)
            i = 0
            while rem > 0 and i < len(side_orders):
                room = round(side_orders[i].qty - alloc[i], 2)
                give = min(room, rem)
                alloc[i] = round(alloc[i] + give, 2)
                rem = round(rem - give, 2)
                i += 1
            for o, a in zip(side_orders, alloc):
                if a > 0:
                    fills.append(Fill(o.id, o.user_id, o.side, a, p))
    return BatchResult(price=p, volume=round(vol, 2), fills=fills, demand=d, supply=s, band_hit=band_hit, candidates=cands)


def next_interval(n_open_orders: int, base: float = 10.0, lo: float = 10.0, hi: float = 60.0) -> float:
    """Sparse markets clear less often (Plan.md 8.3 low volume tuning)."""
    return max(lo, min(hi, base * 20 / max(n_open_orders, 1)))
