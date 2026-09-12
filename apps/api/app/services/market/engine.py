"""The exchange engine: markets, orders, batch clearing, belief update, owner requote.

Storage agnostic (see app/store.py). Pure market math lives in auction.py, treasury.py,
kelly.py; this module is the state machine around them.
"""
from __future__ import annotations

import math
import time
import uuid
from dataclasses import asdict

from app.services.discovery.valuation import Observables, Valuation, value as run_valuation
from app.services.market import auction
from app.services.market.treasury import SHARES, FLOAT_FRAC, FLOOR_FRAC, ask_ladder, buyback_floor
from app.store import Store

STARTING_CASH = 100_000.0
BAND = 0.10
MAX_ORDER_FRAC = 0.05          # of shares outstanding
MAX_NOTIONAL_FRAC = 0.25       # of user cash, open buy notional per market
LIMIT_CLAMP = (0.5, 2.0)       # relative to reference price
TREASURY = "treasury"


def _now() -> float:
    return time.time()


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


class _PosteriorView:
    """Duck typed Valuation for treasury.py: exposes .quantile() and .v0 from a belief."""
    def __init__(self, mu: float, sigma: float):
        self._mu, self._sigma = mu, sigma
        self.v0 = math.exp(mu)
        self.sigma = sigma
    def quantile(self, q: float) -> float:
        from app.services.discovery.valuation import _z
        return math.exp(self._mu + self._sigma * _z(q))


class Engine:
    def __init__(self, store: Store, hub=None):
        self.store = store
        self.hub = hub

    # ---------- users ----------
    def user(self, uid: str) -> dict:
        u = self.store.get_user(uid)
        if u is None:
            u = {"id": uid, "cash": STARTING_CASH, "positions": {}, "realized": 0.0, "created_at": _now()}
            self.store.put_user(u)
        return u

    def reserved_cash(self, uid: str, mid: str | None = None) -> float:
        return sum((o["qty"] - o["filled_qty"]) * o["limit_price"]
                   for o in self.store.user_orders(uid, mid) if o["side"] == "buy" and o["status"] in ("open", "partial"))

    def reserved_shares(self, uid: str, mid: str) -> float:
        return sum(o["qty"] - o["filled_qty"]
                   for o in self.store.user_orders(uid, mid) if o["side"] == "sell" and o["status"] in ("open", "partial"))

    # ---------- companies and markets ----------
    def create_company(self, c: dict) -> dict:
        """c: CompanyIn fields. Runs the valuation ensemble and opens a market."""
        obs_fields = Observables.__dataclass_fields__.keys()
        obs = Observables(**{k: v for k, v in c.items() if k in obs_fields})
        val = run_valuation(obs)
        cid = c.get("id") or _id("co")
        company = {
            "id": cid, "name": c["name"], "category": obs.category, "state": obs.state,
            "city": c.get("city"), "address": c.get("address"), "description": c.get("description"),
            "website": c.get("website"), "phone": c.get("phone"), "naics_guess": c.get("naics_guess"), "lat": c.get("lat"), "lng": c.get("lng"),
            "owners": c.get("owners", []), "status": "ready",
            "observables": {k: getattr(obs, k) for k in obs_fields},
            "valuation": self._val_dict(val), "created_at": _now(),
        }
        self.store.put_company(company)
        self.create_market(cid, val)
        self.store.audit({"t": _now(), "actor": "system", "action": "create_company", "payload": {"id": cid, "v0": val.v0}})
        return company

    @staticmethod
    def _val_dict(v: Valuation) -> dict:
        return {"v0": v.v0, "sigma": v.sigma, "low": v.low, "high": v.high, "method": v.method,
                "disagreement": v.disagreement,
                "estimates": [{"name": e.name, "value": e.value, "sigma": e.sigma, "note": e.note} for e in v.estimates]}

    def create_market(self, cid: str, val: Valuation, interval: float = 10.0) -> dict:
        ref = round(val.v0 / SHARES, 2)
        m = {
            "id": cid, "shares_outstanding": SHARES, "float_shares": SHARES * FLOAT_FRAC, "retained": SHARES * (1 - FLOAT_FRAC),
            "last_price": None, "ref_price": ref, "batch_interval_s": interval, "next_batch_at": _now() + interval,
            "band_pct": BAND, "halted": False, "band_hits": 0,
            "prior": {"mu": math.log(val.v0), "sigma": val.sigma},
            "belief": {"mu": math.log(val.v0), "sigma": val.sigma, "s_m": 0.20, "n_rounds": 0, "obs": []},
            "treasury": {"unsold_float": SHARES * FLOAT_FRAC, "proceeds": 0.0, "floor_qty": SHARES * FLOOR_FRAC,
                         "bought_back": 0.0, "floor_price": 0.0, "ask_ladder": []},
            "fees_collected": 0.0,
        }
        self._requote(m)
        self.store.put_market(m)
        return m

    def _requote(self, m: dict) -> None:
        view = _PosteriorView(m["belief"]["mu"], m["belief"]["sigma"])
        t = m["treasury"]
        t["ask_ladder"] = [{"price": q.price, "qty": q.qty} for q in ask_ladder(view, t["unsold_float"])]
        t["floor_price"] = buyback_floor(view).price if t["floor_qty"] > 0 else 0.0

    def market_value(self, m: dict) -> float:
        return math.exp(m["belief"]["mu"])

    # ---------- orders ----------
    def place_order(self, uid: str, mid: str, side: str, qty: float, limit: float, origin: str = "user") -> dict:
        m = self.store.get_market(mid)
        if m is None:
            raise KeyError("no such market")
        u = self.user(uid)
        qty = round(qty, 2)
        limit = round(limit, 2)
        order = {"id": _id("ord"), "market_id": mid, "user_id": uid, "side": side, "qty": qty, "filled_qty": 0.0,
                 "limit_price": limit, "status": "open", "origin": origin, "created_at": _now(), "seq": time.monotonic_ns(),
                 "reason": None}
        reason = None
        ref = m["last_price"] or m["ref_price"]
        if m["halted"]:
            reason = "market halted this round"
        elif qty < 0.01:
            reason = "min qty 0.01"
        elif qty > MAX_ORDER_FRAC * SHARES:
            reason = f"max order {MAX_ORDER_FRAC * SHARES:.0f} shares"
        elif not (ref * LIMIT_CLAMP[0] <= limit <= ref * LIMIT_CLAMP[1]):
            reason = f"limit must be within {LIMIT_CLAMP[0]}x to {LIMIT_CLAMP[1]}x of {ref}"
        elif side == "buy":
            avail = u["cash"] - self.reserved_cash(uid)
            if qty * limit > avail + 1e-9:
                reason = f"insufficient cash: need {qty * limit:,.2f}, available {avail:,.2f}"
            elif self.reserved_cash(uid, mid) + qty * limit > MAX_NOTIONAL_FRAC * u["cash"] + 1e-9:
                reason = f"open buy notional in one market capped at {MAX_NOTIONAL_FRAC:.0%} of cash"
        else:
            held = u["positions"].get(mid, {}).get("qty", 0.0) - self.reserved_shares(uid, mid)
            if qty > held + 1e-9:
                reason = f"insufficient shares: have {held:.2f} free"
        if reason:
            order["status"], order["reason"] = "rejected", reason
        self.store.put_order(order)
        self.store.audit({"t": order["created_at"], "actor": uid, "action": "place_order", "payload": {k: order[k] for k in ("id", "market_id", "side", "qty", "limit_price", "status", "reason")}})
        if self.hub and not reason:
            self.hub.publish(mid, {"type": "book", "book": self.book(mid)})
        return order

    def cancel_order(self, uid: str, oid: str) -> dict:
        o = self.store.get_order(oid)
        if o is None or o["user_id"] != uid:
            raise KeyError("no such order")
        if o["status"] in ("open", "partial"):
            o["status"] = "cancelled"
            o["cancelled_at"] = _now()
            self.store.put_order(o)
            self.store.audit({"t": _now(), "actor": uid, "action": "cancel_order", "payload": {"id": oid}})
            if self.hub:
                self.hub.publish(o["market_id"], {"type": "book", "book": self.book(o["market_id"])})
        return o

    # ---------- book ----------
    def _treasury_orders(self, m: dict) -> list[auction.Order]:
        t = m["treasury"]
        out = []
        if t["floor_qty"] > 0 and t["floor_price"] > 0:
            out.append(auction.Order("T_floor", TREASURY, "buy", t["floor_qty"], t["floor_price"], 0, "treasury"))
        for i, lvl in enumerate(t["ask_ladder"]):
            if lvl["qty"] > 0:
                out.append(auction.Order(f"T_ask{i}", TREASURY, "sell", lvl["qty"], lvl["price"], 0, "treasury"))
        return out

    def _user_orders(self, mid: str) -> list[auction.Order]:
        return [auction.Order(o["id"], o["user_id"], o["side"], round(o["qty"] - o["filled_qty"], 2), o["limit_price"], o["seq"], o["origin"])
                for o in self.store.open_orders(mid)]

    def book(self, mid: str) -> dict:
        from app import views
        m = self.store.get_market(mid)
        orders = self._treasury_orders(m) + self._user_orders(mid)
        agg: dict[tuple[str, float, str], float] = {}
        for o in orders:
            k = (o.side, o.limit, o.origin)
            agg[k] = round(agg.get(k, 0.0) + o.qty, 2)
        bids = sorted([{"price": p, "qty": q, "origin": og} for (sd, p, og), q in agg.items() if sd == "buy"], key=lambda l: -l["price"])
        asks = sorted([{"price": p, "qty": q, "origin": og} for (sd, p, og), q in agg.items() if sd == "sell"], key=lambda l: l["price"])
        ind, _, _ = auction.clearing_price(auction.self_trade_filter(orders), m["last_price"], m["band_pct"], anchor=m["ref_price"])
        return views.book(m, bids, asks, ind, len(orders))

    # ---------- batch ----------
    def run_batch(self, mid: str) -> dict:
        m = self.store.get_market(mid)
        t0 = _now()
        user_orders = self._user_orders(mid)
        orders = self._treasury_orders(m) + user_orders
        snapshot = self.book(mid)
        halted_now = m["halted"]
        if halted_now:
            res = auction.BatchResult(price=None, volume=0.0)
            m["halted"] = False
            m["band_pct"] = BAND * 2  # one wider round after a halt
        else:
            res = auction.clear(orders, m["last_price"], m["band_pct"], anchor=m["ref_price"])
            m["band_pct"] = BAND
        batch = {"id": _id("b"), "market_id": mid, "t": t0, "clearing_price": res.price if res.volume > 0 else None,
                 "volume": res.volume, "demand": res.demand, "supply": res.supply, "band_hit": res.band_hit,
                 "n_buy": sum(1 for o in orders if o.side == "buy"), "n_sell": sum(1 for o in orders if o.side == "sell"),
                 "book_snapshot": snapshot, "halted": halted_now, "ref_moved": False}
        if res.volume == 0 and res.band_hit and res.price is not None:
            # limit up/down: nothing can trade at the band edge, so the reference steps to the
            # edge with zero volume and the band walks toward the resting interest next round
            m["last_price"] = res.price
            batch["ref_moved"] = True
        if res.volume > 0:
            self._apply_fills(m, batch, res)
            m["last_price"] = res.price
            self._update_belief(m, res.price, res.volume)
            m["band_hits"] = m["band_hits"] + 1 if res.band_hit else 0
            if m["band_hits"] >= 2:
                m["halted"] = True
                m["band_hits"] = 0
                self.store.audit({"t": t0, "actor": "system", "action": "halt", "payload": {"market_id": mid}})
        self._requote(m)
        n_open = len(self.store.open_orders(mid))
        m["batch_interval_s"] = auction.next_interval(n_open + len(self._treasury_orders(m)))
        m["next_batch_at"] = _now() + m["batch_interval_s"]
        self.store.put_market(m)
        self.store.add_batch(batch)
        self.store.audit({"t": t0, "actor": "system", "action": "batch", "payload": {"market_id": mid, "price": batch["clearing_price"], "volume": res.volume, "band_hit": res.band_hit}})
        if self.hub:
            from app import views
            self.hub.publish(mid, {"type": "batch", "batch": views.batch(batch)})
            self.hub.publish(mid, {"type": "book", "book": self.book(mid)})
            if m["halted"]:
                self.hub.publish(mid, {"type": "halt", "market_id": mid, "until_batch": 1, "reason": "two consecutive band hits"})
        if hasattr(self.store, "save"):
            self.store.save()
        return batch

    def _apply_fills(self, m: dict, batch: dict, res: auction.BatchResult) -> None:
        mid, p = m["id"], res.price
        t = m["treasury"]
        buys = [f for f in res.fills if f.side == "buy"]
        sells = [f for f in res.fills if f.side == "sell"]
        # update orders, users, treasury per fill
        for f in res.fills:
            if f.user_id == TREASURY:
                if f.side == "sell":
                    idx = int(f.order_id.replace("T_ask", ""))
                    t["ask_ladder"][idx]["qty"] = round(t["ask_ladder"][idx]["qty"] - f.qty, 2)
                    t["unsold_float"] = round(t["unsold_float"] - f.qty, 2)
                    t["proceeds"] = round(t["proceeds"] + f.qty * p, 2)
                else:
                    t["floor_qty"] = round(t["floor_qty"] - f.qty, 2)
                    t["bought_back"] = round(t["bought_back"] + f.qty, 2)
                continue
            o = self.store.get_order(f.order_id)
            o["filled_qty"] = round(o["filled_qty"] + f.qty, 2)
            o["status"] = "filled" if o["filled_qty"] >= o["qty"] - 1e-9 else "partial"
            self.store.put_order(o)
            u = self.user(f.user_id)
            pos = u["positions"].setdefault(mid, {"qty": 0.0, "avg_cost": 0.0})
            if f.side == "buy":
                u["cash"] = round(u["cash"] - f.qty * p, 2)
                new_qty = pos["qty"] + f.qty
                pos["avg_cost"] = (pos["avg_cost"] * pos["qty"] + p * f.qty) / new_qty if new_qty > 0 else 0.0
                pos["qty"] = round(new_qty, 2)
            else:
                u["cash"] = round(u["cash"] + f.qty * p, 2)
                u["realized"] = round(u.get("realized", 0.0) + (p - pos["avg_cost"]) * f.qty, 2)
                pos["qty"] = round(pos["qty"] - f.qty, 2)
                if pos["qty"] <= 0:
                    u["positions"].pop(mid, None)
            self.store.put_user(u)
        # pair fills into trades (buyer, seller, qty)
        bi, si = 0, 0
        brem = [f.qty for f in buys]
        srem = [f.qty for f in sells]
        while bi < len(buys) and si < len(sells):
            q = round(min(brem[bi], srem[si]), 2)
            if q > 0:
                self.store.add_trade({"id": _id("tr"), "market_id": mid, "batch_id": batch["id"], "buyer_id": buys[bi].user_id,
                                      "seller_id": sells[si].user_id, "qty": q, "price": p, "t": batch["t"]})
            brem[bi] = round(brem[bi] - q, 2)
            srem[si] = round(srem[si] - q, 2)
            if brem[bi] <= 0: bi += 1
            if srem[si] <= 0: si += 1

    def _update_belief(self, m: dict, price: float, volume: float) -> None:
        """Plan.md 8.2b: normal-normal update in log space, volume weighted, realized vol blend."""
        b, pr = m["belief"], m["prior"]
        b["obs"].append({"lnp": math.log(price * SHARES), "vol": volume})
        b["obs"] = b["obs"][-50:]
        b["n_rounds"] += 1
        avg_vol = sum(o["vol"] for o in b["obs"]) / len(b["obs"])
        lnps = [o["lnp"] for o in b["obs"][-20:]]
        if len(lnps) >= 3:
            mean = sum(lnps) / len(lnps)
            realized = math.sqrt(sum((x - mean) ** 2 for x in lnps) / (len(lnps) - 1))
            b["s_m"] = max(0.05, realized)
        else:
            realized = 0.0
        prec0 = 1 / pr["sigma"] ** 2
        precm = sum(o["vol"] / avg_vol for o in b["obs"]) / b["s_m"] ** 2
        num = pr["mu"] * prec0 + sum(o["vol"] / avg_vol * o["lnp"] for o in b["obs"]) / b["s_m"] ** 2
        b["mu"] = num / (prec0 + precm)
        b["sigma"] = max(0.08, math.sqrt(1 / (prec0 + precm) + realized ** 2))

    # ---------- views (contract shapes live in app/views.py) ----------
    def market_out(self, m: dict) -> dict:
        from app import views
        return views.market_summary(m)

    def company_out(self, c: dict) -> dict:
        from app import views
        return views.company(c, self.store.get_market(c["id"]))

    def card(self, c: dict) -> dict:
        from app import views
        return views.card(c, self.store.get_market(c["id"]), self.book(c["id"]))

    def portfolio(self, uid: str) -> dict:
        u = self.user(uid)
        positions, equity, unreal = [], u["cash"], 0.0
        for mid, pos in u["positions"].items():
            m = self.store.get_market(mid)
            c = self.store.get_company(mid)
            px = m["last_price"] or m["ref_price"]
            mv = pos["qty"] * px
            pnl = mv - pos["qty"] * pos["avg_cost"]
            equity += mv
            unreal += pnl
            positions.append({"market_id": mid, "name": c["name"], "qty": pos["qty"], "avg_cost": round(pos["avg_cost"], 2),
                              "last": m["last_price"], "value": round(mv, 2), "pnl": round(pnl, 2)})
        realized = round(u.get("realized", 0.0), 2)
        return {"user_id": uid, "cash": round(u["cash"], 2), "reserved_cash": round(self.reserved_cash(uid), 2),
                "equity": round(equity, 2), "pnl": {"realized": realized, "unrealized": round(unreal, 2), "total": round(realized + unreal, 2)},
                "positions": positions}

    def tick(self) -> list[dict]:
        """Run every market whose round has ended. Called by the scheduler."""
        out = []
        now = _now()
        for m in self.store.list_markets():
            if now >= m["next_batch_at"]:
                out.append(self.run_batch(m["id"]))
        return out
