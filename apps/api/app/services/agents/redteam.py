"""Red team: Grok plays a market manipulator so the surveillance layer has something real to catch.

Grok picks an attack and its parameters (or a random plan when no key is set); the primitives
execute through bot accounts against the live engine; the rules + Grok/K2 reviewers must flag it.
Spoof cancels are scheduled and fired by tick() just before the round clears.
"""
from __future__ import annotations

import random
import time
from pydantic import BaseModel, Field

from app.services.agents import grok
from app.services.market.engine import Engine

SYSTEM = ("You are red teaming a batch auction exchange for fractional shares of small businesses. Rounds clear every 10 to 60 seconds "
          "at one uniform price; a 10% band limits moves per round; the owner posts an ask ladder and a buyback floor; users have 100,000 in cash; "
          "max order is 500 shares. Pick ONE manipulation to attempt against the given market and set its parameters so it is plausible and "
          "hard to distinguish from real trading. Explain your plan in two sentences as the attacker would.")

_pending_cancels: list[tuple[str, str, str, float]] = []   # (market_id, user, order_id, cancel_at)
_log: list[dict] = []


class AttackPlan(BaseModel):
    attack: str = Field(description="wash | spoof | pump")
    rounds: int = Field(ge=1, le=6, description="how many rounds to sustain it")
    size: float = Field(ge=1, le=400, description="shares per order")
    offset_pct: float = Field(ge=0, le=15, description="how far from the last price to place orders, percent")
    rationale: str


def random_plan() -> AttackPlan:
    a = random.choice(["wash", "spoof", "pump"])
    return AttackPlan(attack=a, rounds=3, size=random.choice([20, 40, 80]), offset_pct=random.choice([2, 4, 8]),
                      rationale=f"Random {a} plan (no model key configured).")


async def plan(c: dict, m: dict) -> AttackPlan:
    user = (f"Market: {c['name']} ({c['category']}). Last price {m['last_price'] or m['ref_price']}, band {m['band_pct']:.0%}, "
            f"owner floor {m['treasury']['floor_price']}, ask ladder {[l['price'] for l in m['treasury']['ask_ladder']]}, "
            f"round length {m['batch_interval_s']:.0f}s.")
    out = await grok.structured("redteam", AttackPlan, SYSTEM, user, temperature=0.8, cache=False)
    if out is None or out.attack not in ("wash", "spoof", "pump"):
        return random_plan()
    return out


def execute(e: Engine, mid: str, p: AttackPlan) -> dict:
    """Place the first round of the attack now. Later rounds are placed by tick()."""
    m = e.store.get_market(mid)
    ref = m["last_price"] or m["ref_price"]
    placed = []
    if p.attack == "wash":
        a, b = "wash_a", "wash_b"
        e.user(a); e.user(b)
        px = round(ref * (1 + p.offset_pct / 100), 2)
        held = e.user(a)["positions"].get(mid, {}).get("qty", 0)
        if held < p.size:   # accumulate first so the pair has something to pass back and forth
            placed.append(e.place_order(a, mid, "buy", p.size, round(ref * 1.03, 2), origin="bot"))
        else:
            placed.append(e.place_order(a, mid, "sell", p.size, px, origin="bot"))
            placed.append(e.place_order(b, mid, "buy", p.size, px, origin="bot"))
    elif p.attack == "spoof":
        u = "spoof_1"
        e.user(u)
        for i in range(3):   # layered bids well below where anything clears, cancelled before the round
            px = round(ref * (1 - (p.offset_pct + 2 * i) / 100), 2)
            o = e.place_order(u, mid, "buy", p.size, px, origin="bot")
            placed.append(o)
            if o["status"] == "open":
                _pending_cancels.append((mid, u, o["id"], m["next_batch_at"] - 1.0))
        held = e.user(u)["positions"].get(mid, {}).get("qty", 0)
        if held > 0:   # the real intent: sell into the bid interest the layers suggest
            placed.append(e.place_order(u, mid, "sell", round(min(held, p.size), 2), round(ref * 0.995, 2), origin="bot"))
        else:
            placed.append(e.place_order(u, mid, "buy", round(p.size / 2, 2), round(ref * 1.01, 2), origin="bot"))
    else:  # pump: one account buys aggressively at the band edge for several rounds
        u = "pump_1"
        e.user(u)
        px = round(ref * (1 + min(p.offset_pct, 9.5) / 100), 2)
        placed.append(e.place_order(u, mid, "buy", min(p.size * 2, 400), px, origin="bot"))
    rec = {"t": time.time(), "market_id": mid, "plan": p.model_dump(), "rounds_left": p.rounds - 1,
           "orders": [o["id"] for o in placed], "rejected": [o["reason"] for o in placed if o["status"] == "rejected"]}
    _log.append(rec)
    e.store.audit({"t": rec["t"], "actor": "redteam", "action": "attack", "payload": {"market_id": mid, "attack": p.attack, "rationale": p.rationale}})
    return rec


def tick(e: Engine) -> None:
    """Fire scheduled spoof cancels and continue multi round attacks. Called every scheduler tick."""
    now = time.time()
    keep = []
    for mid, u, oid, at in _pending_cancels:
        if now >= at:
            try:
                e.cancel_order(u, oid)
            except KeyError:
                pass
        else:
            keep.append((mid, u, oid, at))
    _pending_cancels[:] = keep
    for rec in _log:
        if rec["rounds_left"] > 0 and now - rec["t"] > e.store.get_market(rec["market_id"])["batch_interval_s"]:
            rec["t"] = now
            rec["rounds_left"] -= 1
            execute(e, rec["market_id"], AttackPlan(**rec["plan"]))


def log() -> list[dict]:
    return _log[-20:]
