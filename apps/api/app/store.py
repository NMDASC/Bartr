"""Storage boundary. The engine only touches the store through these methods, so the
teammate's simulated DB (or MongoDB Atlas) plugs in as another class with the same
methods. Everything is plain dicts so any backend can persist them as is.

MemoryStore is the default and is what the tests run against. It can snapshot to a
JSON file (STATE_FILE) so a demo survives a restart.
"""
from __future__ import annotations

import json
from copy import deepcopy
import os
from typing import Protocol
from threading import RLock


class Store(Protocol):
    # companies
    def put_company(self, c: dict) -> None: ...
    def get_company(self, cid: str) -> dict | None: ...
    def list_companies(self) -> list[dict]: ...
    # markets (one per company, same id)
    def put_market(self, m: dict) -> None: ...
    def get_market(self, mid: str) -> dict | None: ...
    def list_markets(self) -> list[dict]: ...
    # orders
    def put_order(self, o: dict) -> None: ...
    def get_order(self, oid: str) -> dict | None: ...
    def open_orders(self, mid: str) -> list[dict]: ...
    def cancelled_orders(self, mid: str) -> list[dict]: ...
    def user_orders(self, uid: str, mid: str | None = None) -> list[dict]: ...
    # batches, trades
    def add_batch(self, b: dict) -> None: ...
    def batches(self, mid: str, limit: int = 50) -> list[dict]: ...
    def add_trade(self, t: dict) -> None: ...
    def trades(self, mid: str, limit: int = 50) -> list[dict]: ...
    def user_trades(self, uid: str, limit: int = 100) -> list[dict]: ...
    def user_trade_summary(self, uid: str) -> dict: ...
    # users: {id, cash, positions: {mid: {qty, avg_cost}}, email?, display_name?}
    def get_user(self, uid: str) -> dict | None: ...
    def put_user(self, u: dict) -> None: ...
    # identity: lets a demo session be claimed by a later real login (DECISIONS 011)
    def find_user_by_email(self, email: str) -> dict | None: ...
    def list_users(self) -> list[dict]: ...
    # Acquisition documents are separate from cash/positions to avoid settlement races.
    def get_draft(self, uid: str, cid: str) -> dict | None: ...
    def put_draft(self, uid: str, cid: str, draft: dict) -> None: ...
    def user_drafts(self, uid: str) -> list[dict]: ...
    # offers to owners of discovered businesses
    def put_offer(self, o: dict) -> None: ...
    def get_offer(self, oid: str) -> dict | None: ...
    def list_offers(self, user_id: str | None = None, company_id: str | None = None) -> list[dict]: ...
    # audit
    def audit(self, event: dict) -> None: ...
    def audit_log(self, limit: int = 200) -> list[dict]: ...
    def audit_page(self, calls: bool, before: float, offset: int, limit: int, query: str = "") -> list[dict]: ...
    def linked_audit(self, *, actors: list[str], flag_ids: list[str], market_id: str | None = None,
                     calls_only: bool = False, limit: int = 100) -> list[dict]: ...
    def audit_counts(self) -> dict: ...
    def put_case(self, case: dict) -> None: ...
    def list_cases(self) -> list[dict]: ...


class MemoryStore:
    def __init__(self, state_file: str | None = None):
        self.state_file = state_file
        self._save_lock = RLock()
        self.companies: dict[str, dict] = {}
        self.markets: dict[str, dict] = {}
        self.orders: dict[str, dict] = {}
        self._batches: dict[str, list[dict]] = {}
        self._trades: dict[str, list[dict]] = {}
        self.users: dict[str, dict] = {}
        self.offers: dict[str, dict] = {}
        self._audit: list[dict] = []
        self.cases: dict[str, dict] = {}
        self.acquisitions: dict[str, dict[str, dict]] = {}
        if state_file and os.path.exists(state_file):
            self.load(state_file)

    # companies
    def put_company(self, c): self.companies[c["id"]] = c
    def get_company(self, cid): return self.companies.get(cid)
    def list_companies(self): return list(self.companies.values())
    # markets
    def put_market(self, m): self.markets[m["id"]] = m
    def get_market(self, mid): return self.markets.get(mid)
    def list_markets(self): return list(self.markets.values())
    # orders
    def put_order(self, o): self.orders[o["id"]] = o
    def get_order(self, oid): return self.orders.get(oid)
    def open_orders(self, mid):
        return [o for o in self.orders.values() if o["market_id"] == mid and o["status"] in ("open", "partial")]
    def cancelled_orders(self, mid):
        return [o for o in self.orders.values() if o["market_id"] == mid and o["status"] == "cancelled" and o["filled_qty"] == 0]
    def user_orders(self, uid, mid=None):
        return [o for o in self.orders.values() if o["user_id"] == uid and (mid is None or o["market_id"] == mid)]
    # batches, trades
    def add_batch(self, b): self._batches.setdefault(b["market_id"], []).append(b)
    def batches(self, mid, limit=50): return self._batches.get(mid, [])[-limit:]
    def add_trade(self, t): self._trades.setdefault(t["market_id"], []).append(t)
    def trades(self, mid, limit=50): return self._trades.get(mid, [])[-limit:]
    def user_trades(self, uid, limit=100):
        from heapq import nlargest
        matches = (t for rows in self._trades.values() for t in rows if uid in (t["buyer_id"], t["seller_id"]))
        return list(reversed(nlargest(limit, matches, key=lambda t: (t["t"], t["id"]))))
    def user_trade_summary(self, uid):
        count, notional = 0, 0.0
        for rows in self._trades.values():
            for trade in rows:
                if uid in (trade["buyer_id"], trade["seller_id"]):
                    count += 1
                    notional += trade["qty"] * trade["price"]
        return {"trades": count, "traded_notional": round(notional, 2)}
    # users
    def get_user(self, uid): return self.users.get(uid)
    def put_user(self, u): self.users[u["id"]] = u
    def find_user_by_email(self, email):
        return next((u for u in self.users.values() if u.get("email") == email), None)
    def list_users(self): return list(self.users.values())
    # Per-user drafts; return copies so caller edits cannot mutate saved state.
    def get_draft(self, uid, cid):
        return deepcopy(self.acquisitions.get(uid, {}).get(cid) or self.users.get(uid, {}).get("acquisitions", {}).get(cid))
    def put_draft(self, uid, cid, draft):
        self.acquisitions.setdefault(uid, {})[cid] = deepcopy(draft)
    def user_drafts(self, uid):
        return list(deepcopy({**self.users.get(uid, {}).get("acquisitions", {}), **self.acquisitions.get(uid, {})}).values())
    # offers
    def put_offer(self, o): self.offers[o["id"]] = o
    def get_offer(self, oid): return self.offers.get(oid)
    def list_offers(self, user_id=None, company_id=None):
        return [o for o in self.offers.values() if (user_id is None or o["buyer_id"] == user_id) and (company_id is None or o["company_id"] == company_id)]
    # audit
    def audit(self, event):
        self._audit.append(event)
    def audit_log(self, limit=200): return self._audit[-limit:]
    def audit_page(self, calls, before, offset, limit, query=""):
        rows = (e for e in reversed(self._audit) if e["t"] <= before and (e.get("action") == "agent_call") == calls)
        if query:
            rows = (e for e in rows if query.casefold() in json.dumps(e, default=str).casefold())
        from itertools import islice
        return list(islice(rows, offset, offset + limit))
    def linked_audit(self, *, actors, flag_ids, market_id=None, calls_only=False, limit=100):
        from heapq import nlargest
        actor_ids, case_ids = set(actors), set(flag_ids)
        def matches(event):
            if calls_only and event.get("action") != "agent_call":
                return False
            if event.get("flag_id") in case_ids:
                return True
            payload = event.get("payload") or {}
            participants = (event.get("actor"), payload.get("user_id"), payload.get("buyer_id"), payload.get("seller_id"))
            return bool(actor_ids.intersection(participants)) and (market_id is None or market_id in (event.get("market_id"), payload.get("market_id")))
        rows = nlargest(limit, (e for e in self._audit if matches(e)), key=lambda e: (e["t"], e.get("id", "")))
        return list(reversed(rows))
    def audit_counts(self):
        calls = [e for e in self._audit if e.get("action") == "agent_call"]
        return {"calls": len(calls), "errors": sum(e.get("payload", {}).get("status") == "error" for e in calls)}
    def put_case(self, case): self.cases[case["id"]] = case
    def list_cases(self): return list(self.cases.values())

    # snapshot
    def save(self, path: str | None = None):
        path = path or self.state_file
        if not path:
            return
        with self._save_lock:
            data = {"companies": self.companies, "markets": self.markets, "orders": self.orders,
                    "batches": self._batches, "trades": self._trades, "users": self.users,
                    "audit": self._audit, "cases": self.cases, "acquisitions": self.acquisitions, "offers": self.offers}
            tmp = path + ".tmp"
            snapshot = json.dumps(data)
            with open(tmp, "w") as f:
                f.write(snapshot)
            os.replace(tmp, path)

    def load(self, path: str):
        with open(path) as f:
            d = json.load(f)
        self.companies, self.markets, self.orders = d["companies"], d["markets"], d["orders"]
        self._batches, self._trades, self.users = d["batches"], d["trades"], d["users"]
        self._audit, self.cases = d.get("audit", []), d.get("cases", {})
        self.acquisitions = d.get("acquisitions", {})
        self.offers = d.get("offers", {})
