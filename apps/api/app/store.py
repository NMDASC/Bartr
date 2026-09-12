"""Storage boundary. The engine only touches the store through these methods, so the
teammate's simulated DB (or MongoDB Atlas) plugs in as another class with the same
methods. Everything is plain dicts so any backend can persist them as is.

MemoryStore is the default and is what the tests run against. It can snapshot to a
JSON file (STATE_FILE) so a demo survives a restart.
"""
from __future__ import annotations

import json
import os
from typing import Protocol


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
    def open_orders_all(self) -> list[dict]: ...                 # every open/partial order, one query
    def market_orders(self, mid: str) -> list[dict]: ...         # every order in a market, any status
    def user_orders(self, uid: str, mid: str | None = None) -> list[dict]: ...
    # batches, trades
    def add_batch(self, b: dict) -> None: ...
    def batches(self, mid: str, limit: int = 50) -> list[dict]: ...
    def add_trade(self, t: dict) -> None: ...
    def trades(self, mid: str, limit: int = 50) -> list[dict]: ...
    def trades_recent(self, limit: int = 2000) -> list[dict]: ...   # across markets, oldest first
    # users: {id, cash, positions: {mid: {qty, avg_cost}}, email?, display_name?}
    def get_user(self, uid: str) -> dict | None: ...
    def put_user(self, u: dict) -> None: ...
    # identity: lets a demo session be claimed by a later real login (DECISIONS 011)
    def find_user_by_email(self, email: str) -> dict | None: ...
    def list_users(self) -> list[dict]: ...
    # offers to owners of discovered businesses
    def put_offer(self, o: dict) -> None: ...
    def get_offer(self, oid: str) -> dict | None: ...
    def list_offers(self, user_id: str | None = None, company_id: str | None = None) -> list[dict]: ...
    # audit
    def audit(self, event: dict) -> None: ...
    def audit_log(self, limit: int = 200) -> list[dict]: ...


class MemoryStore:
    def __init__(self, state_file: str | None = None):
        self.state_file = state_file
        self.companies: dict[str, dict] = {}
        self.markets: dict[str, dict] = {}
        self.orders: dict[str, dict] = {}
        self._batches: dict[str, list[dict]] = {}
        self._trades: dict[str, list[dict]] = {}
        self.users: dict[str, dict] = {}
        self.offers: dict[str, dict] = {}
        self._audit: list[dict] = []
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
    def open_orders_all(self):
        return [o for o in self.orders.values() if o["status"] in ("open", "partial")]
    def market_orders(self, mid):
        return [o for o in self.orders.values() if o["market_id"] == mid]
    def user_orders(self, uid, mid=None):
        return [o for o in self.orders.values() if o["user_id"] == uid and (mid is None or o["market_id"] == mid)]
    # batches, trades
    def add_batch(self, b): self._batches.setdefault(b["market_id"], []).append(b)
    def batches(self, mid, limit=50): return self._batches.get(mid, [])[-limit:]
    def add_trade(self, t): self._trades.setdefault(t["market_id"], []).append(t)
    def trades(self, mid, limit=50): return self._trades.get(mid, [])[-limit:]
    def trades_recent(self, limit=2000):
        allt = sorted((t for ts in self._trades.values() for t in ts), key=lambda t: t["t"])
        return allt[-limit:]
    # users
    def get_user(self, uid): return self.users.get(uid)
    def put_user(self, u): self.users[u["id"]] = u
    def find_user_by_email(self, email):
        return next((u for u in self.users.values() if u.get("email") == email), None)
    def list_users(self): return list(self.users.values())
    # offers
    def put_offer(self, o): self.offers[o["id"]] = o
    def get_offer(self, oid): return self.offers.get(oid)
    def list_offers(self, user_id=None, company_id=None):
        return [o for o in self.offers.values() if (user_id is None or o["buyer_id"] == user_id) and (company_id is None or o["company_id"] == company_id)]
    # audit
    def audit(self, event):
        self._audit.append(event)
        if len(self._audit) > 20_000:
            self._audit = self._audit[-10_000:]
    def audit_log(self, limit=200): return self._audit[-limit:]

    # snapshot
    def save(self, path: str | None = None):
        path = path or self.state_file
        if not path:
            return
        data = {"companies": self.companies, "markets": self.markets, "orders": self.orders,
                "batches": self._batches, "trades": self._trades, "users": self.users}
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f)
        os.replace(tmp, path)

    def load(self, path: str):
        with open(path) as f:
            d = json.load(f)
        self.companies, self.markets, self.orders = d["companies"], d["markets"], d["orders"]
        self._batches, self._trades, self.users = d["batches"], d["trades"], d["users"]
