"""Demo bot traders. Each bot has a private value per market (model value x lognormal noise)
and sizes with half Kelly. One planted wash pair (wash_a, wash_b) for the surveillance demo.
"""
from __future__ import annotations

import math
import random

from app.services.market.engine import Engine
from app.services.market.kelly import kelly_fraction
from app.services.market.treasury import SHARES


class Bots:
    def __init__(self, engine: Engine, n: int = 20, seed: int = 7, noise: float = 0.3, wash: bool = True):
        self.e = engine
        self.rng = random.Random(seed)
        self.names = [f"bot{i:02d}" for i in range(n)]
        self.noise = noise
        self.wash = wash
        self.private: dict[tuple[str, str], float] = {}

    def _pv(self, bot: str, m: dict) -> float:
        key = (bot, m["id"])
        model = math.exp(m["prior"]["mu"]) / SHARES
        if key not in self.private:
            self.private[key] = model * math.exp(self.rng.gauss(0, self.noise * m["prior"]["sigma"]))
        # slow random walk of opinion, pulled gently toward the last print so bots follow the market, not fight it
        last = m["last_price"] or model
        self.private[key] = self.private[key] * math.exp(self.rng.gauss(0, 0.006)) * 0.97 + last * 0.03
        return self.private[key]

    def step(self, max_markets: int = 8) -> int:
        """Place a handful of orders across markets. Returns number placed."""
        placed = 0
        markets = self.e.store.list_markets()
        self.rng.shuffle(markets)
        for m in markets[:max_markets]:
            ref = m["last_price"] or m["ref_price"]
            for bot in self.rng.sample(self.names, k=min(4, len(self.names))):
                u = self.e.user(bot)
                pv = self._pv(bot, m)
                mu, f = kelly_fraction(ref, pv, m["belief"]["sigma"])
                held = u["positions"].get(m["id"], {}).get("qty", 0.0)
                lo, hi = ref * 0.96, ref * 1.04   # nobody bids a tenth away from the last print
                # flow: a quarter of the time a bot trades for its own reasons, near the last print, small size
                if self.rng.random() < 0.25:
                    if held >= 2 and self.rng.random() < 0.5:
                        o = self.e.place_order(bot, m["id"], "sell", max(1, round(held * 0.3)), round(ref * self.rng.uniform(0.985, 1.005), 2), origin="bot")
                    else:
                        o = self.e.place_order(bot, m["id"], "buy", self.rng.choice([2, 3, 5, 8]), round(ref * self.rng.uniform(0.995, 1.02), 2), origin="bot")
                    placed += o["status"] != "rejected"
                    continue
                if f > 0 and self.rng.random() < 0.6:
                    usd = min(f * u["cash"] * 0.25, u["cash"] * 0.02)
                    qty = max(1, round(usd / ref))
                    limit = min(hi, max(lo, pv * self.rng.uniform(0.995, 1.01)))
                    o = self.e.place_order(bot, m["id"], "buy", qty, round(limit, 2), origin="bot")
                    placed += o["status"] != "rejected"
                elif held >= 1 and pv < ref * 0.99 and self.rng.random() < 0.6:
                    limit = min(hi, max(lo, pv * self.rng.uniform(0.99, 1.0)))
                    o = self.e.place_order(bot, m["id"], "sell", max(1, round(held * 0.5)), round(limit, 2), origin="bot")
                    placed += o["status"] != "rejected"
            # cancel stale bot orders (older than 3 rounds)
            for bot in self.names:
                for o in self.e.store.user_orders(bot, m["id"]):
                    if o["status"] in ("open", "partial") and o["created_at"] < m["next_batch_at"] - 3 * m["batch_interval_s"]:
                        self.e.cancel_order(bot, o["id"])
        if self.wash and markets:
            m = markets[0]
            ref = m["last_price"] or m["ref_price"]
            a, b = self.e.user("wash_a"), self.e.user("wash_b")
            if a["positions"].get(m["id"], {}).get("qty", 0) >= 5:
                self.e.place_order("wash_a", m["id"], "sell", 5, round(ref * 1.04, 2), origin="bot")
                self.e.place_order("wash_b", m["id"], "buy", 5, round(ref * 1.04, 2), origin="bot")
            else:
                self.e.place_order("wash_a", m["id"], "buy", 5, round(ref * 1.02, 2), origin="bot")
        return placed
