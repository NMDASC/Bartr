"""MongoDB implementation of the Store protocol. Owner: Vir. See DECISIONS 011.

Decision 005 asked for the real database to arrive as another class with the
same methods, constructed in deps.py. This is that class, so the engine, the
routers and the tests are untouched by it.

Synchronous, using pymongo rather than motor, because `Store` and
`engine.tick()` are synchronous. An async driver would need the engine turned
inside out for no benefit at this scale: a batch touches a few hundred
documents and the scheduler already blocks on the clearing maths.

Documents are stored exactly as the engine hands them over, with `_id` set from
the dict's own `id` so a natural key is the primary key and `put_*` is an
idempotent replace. The `id` field is kept in the body too, so a document read
back is identical to the one written.
"""

from __future__ import annotations

import copy
import threading

from pymongo import ASCENDING, DESCENDING, MongoClient


def _w(doc: dict) -> dict:
    """Outbound: key the document by its own id."""
    return {**doc, "_id": doc["id"]}


def _r(doc: dict | None) -> dict | None:
    """Inbound: drop the duplicate key so callers see what they wrote."""
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


class MongoStore:
    def __init__(self, uri: str, db_name: str = "jb", *, timeout_ms: int = 3000):
        self.client = MongoClient(uri, serverSelectionTimeoutMS=timeout_ms)
        self.db = self.client[db_name]
        self.name = db_name
        # Companies and markets are read whole on every search, every tick and every
        # health check, and a full scan of the companies collection over Atlas costs
        # seconds. This process is the only writer (one uvicorn worker), so both
        # collections are mirrored in memory after the first read and kept current by
        # put_*. Mongo stays the source of truth; reads just stop crossing the network.
        # Callers mutate what they read, so every read hands out a copy.
        self._lock = threading.RLock()
        self._companies: dict[str, dict] | None = None
        self._markets: dict[str, dict] | None = None

    def _company_cache(self) -> dict[str, dict]:
        with self._lock:
            if self._companies is None:
                self._companies = {d["_id"]: _r(d) for d in self.db.companies.find()}
            return self._companies

    def _market_cache(self) -> dict[str, dict]:
        with self._lock:
            if self._markets is None:
                self._markets = {d["_id"]: _r(d) for d in self.db.markets.find()}
            return self._markets

    def ping(self) -> bool:
        try:
            self.client.admin.command("ping")
            return True
        except Exception:  # noqa: BLE001 - callers only need the boolean
            return False

    # companies
    def put_company(self, c: dict) -> None:
        self.db.companies.replace_one({"_id": c["id"]}, _w(c), upsert=True)
        with self._lock:
            if self._companies is not None:
                self._companies[c["id"]] = copy.deepcopy(c)

    def get_company(self, cid: str) -> dict | None:
        with self._lock:
            return copy.deepcopy(self._company_cache().get(cid))

    def list_companies(self) -> list[dict]:
        with self._lock:
            return [copy.deepcopy(c) for c in self._company_cache().values()]

    # markets
    def put_market(self, m: dict) -> None:
        self.db.markets.replace_one({"_id": m["id"]}, _w(m), upsert=True)
        with self._lock:
            if self._markets is not None:
                self._markets[m["id"]] = copy.deepcopy(m)

    def get_market(self, mid: str) -> dict | None:
        with self._lock:
            return copy.deepcopy(self._market_cache().get(mid))

    def list_markets(self) -> list[dict]:
        with self._lock:
            return [copy.deepcopy(m) for m in self._market_cache().values()]

    # orders
    def put_order(self, o: dict) -> None:
        self.db.orders.replace_one({"_id": o["id"]}, _w(o), upsert=True)

    def get_order(self, oid: str) -> dict | None:
        return _r(self.db.orders.find_one({"_id": oid}))

    def open_orders(self, mid: str) -> list[dict]:
        cur = self.db.orders.find({"market_id": mid, "status": {"$in": ["open", "partial"]}})
        return [_r(d) for d in cur]

    def cancelled_orders(self, mid: str) -> list[dict]:
        return [_r(d) for d in self.db.orders.find({"market_id": mid, "status": "cancelled", "filled_qty": 0})]
    def open_orders_all(self) -> list[dict]:
        return [_r(d) for d in self.db.orders.find({"status": {"$in": ["open", "partial"]}})]

    def market_orders(self, mid: str) -> list[dict]:
        return [_r(d) for d in self.db.orders.find({"market_id": mid})]

    def user_orders(self, uid: str, mid: str | None = None) -> list[dict]:
        q: dict = {"user_id": uid}
        if mid is not None:
            q["market_id"] = mid
        return [_r(d) for d in self.db.orders.find(q)]

    # batches, trades. MemoryStore returns the last `limit` in insertion order,
    # so these sort newest first, truncate, then flip back to oldest first.
    def add_batch(self, b: dict) -> None:
        self.db.batches.replace_one({"_id": b["id"]}, _w(b), upsert=True)

    def batches(self, mid: str, limit: int = 50) -> list[dict]:
        cur = self.db.batches.find({"market_id": mid}).sort("t", DESCENDING).limit(limit)
        return [_r(d) for d in reversed(list(cur))]

    def add_trade(self, t: dict) -> None:
        self.db.trades.replace_one({"_id": t["id"]}, _w(t), upsert=True)

    def trades(self, mid: str, limit: int = 50) -> list[dict]:
        cur = self.db.trades.find({"market_id": mid}).sort("t", DESCENDING).limit(limit)
        return [_r(d) for d in reversed(list(cur))]

    def user_trades(self, uid: str, limit: int = 100) -> list[dict]:
        if limit <= 0:
            return []
        cur = self.db.trades.find({"$or": [{"buyer_id": uid}, {"seller_id": uid}]}).sort([("t", DESCENDING), ("id", DESCENDING)]).limit(limit)
        return [_r(d) for d in reversed(list(cur))]

    def user_trade_summary(self, uid: str) -> dict:
        rows = self.db.trades.aggregate([
            {"$match": {"$or": [{"buyer_id": uid}, {"seller_id": uid}]}},
            {"$group": {"_id": None, "trades": {"$sum": 1},
                        "traded_notional": {"$sum": {"$multiply": ["$qty", "$price"]}}}},
        ])
        summary = next(iter(rows), {})
        return {"trades": summary.get("trades", 0), "traded_notional": round(summary.get("traded_notional", 0), 2)}

    def trades_recent(self, limit: int = 2000) -> list[dict]:
        cur = self.db.trades.find().sort("t", DESCENDING).limit(limit)
        return [_r(d) for d in reversed(list(cur))]

    # users
    def get_user(self, uid: str) -> dict | None:
        return _r(self.db.users.find_one({"_id": uid}))

    def put_user(self, u: dict) -> None:
        self.db.users.replace_one({"_id": u["id"]}, _w(u), upsert=True)

    def find_user_by_email(self, email: str) -> dict | None:
        return _r(self.db.users.find_one({"email": email}))

    def list_users(self) -> list[dict]:
        return [_r(d) for d in self.db.users.find()]

    # Separate documents prevent a background checklist from overwriting balances.
    def get_draft(self, uid: str, cid: str) -> dict | None:
        doc = self.db.acquisitions.find_one({"_id": f"{len(uid)}:{uid}{cid}"})
        if doc:
            return doc["draft"]
        return (self.get_user(uid) or {}).get("acquisitions", {}).get(cid)

    def put_draft(self, uid: str, cid: str, draft: dict) -> None:
        key = f"{len(uid)}:{uid}{cid}"
        self.db.acquisitions.replace_one({"_id": key}, {"_id": key, "user_id": uid, "market_id": cid, "draft": draft}, upsert=True)

    def user_drafts(self, uid: str) -> list[dict]:
        rows = dict((self.get_user(uid) or {}).get("acquisitions", {}))
        rows.update({d["market_id"]: d["draft"] for d in self.db.acquisitions.find({"user_id": uid})})
        return list(rows.values())
    # offers
    def put_offer(self, o: dict) -> None:
        self.db.offers.replace_one({"_id": o["id"]}, _w(o), upsert=True)

    def get_offer(self, oid: str) -> dict | None:
        return _r(self.db.offers.find_one({"_id": oid}))

    def list_offers(self, user_id: str | None = None, company_id: str | None = None) -> list[dict]:
        q: dict = {}
        if user_id:
            q["buyer_id"] = user_id
        if company_id:
            q["company_id"] = company_id
        return [_r(d) for d in self.db.offers.find(q).sort("created_at", ASCENDING)]

    # audit. Append only: no natural id, and it is never updated.
    def audit(self, event: dict) -> None:
        self.db.audit_log.insert_one(dict(event))

    def audit_log(self, limit: int = 200) -> list[dict]:
        cur = self.db.audit_log.find().sort("t", DESCENDING).limit(limit)
        return [_r(d) for d in reversed(list(cur))]

    def audit_page(self, calls, before, offset, limit, query=""):
        import json
        from itertools import islice
        match = {"t": {"$lte": before}, "action": "agent_call" if calls else {"$ne": "agent_call"}}
        cursor = self.db.audit_log.find(match).sort([("t", DESCENDING), ("_id", DESCENDING)])
        if not query:
            return [_r(d) for d in cursor.skip(offset).limit(limit)]
        # Search arbitrary nested model output without copying the entire log to
        # memory. A deployment may replace this with its indexed search service.
        rows = (_r(d) for d in cursor.batch_size(200))
        matches = (e for e in rows if query.casefold() in json.dumps(e, default=str).casefold())
        return list(islice(matches, offset, offset + limit))

    def linked_audit(self, *, actors, flag_ids, market_id=None, calls_only=False, limit=100):
        if limit <= 0 or not (actors or flag_ids):
            return []
        links = []
        if flag_ids:
            links.append({"flag_id": {"$in": list(flag_ids)}})
        if actors:
            participants = {"$or": [{field: {"$in": list(actors)}} for field in
                                     ("actor", "payload.user_id", "payload.buyer_id", "payload.seller_id")]}
            if market_id is not None:
                participants = {"$and": [participants, {"$or": [{"market_id": market_id}, {"payload.market_id": market_id}]}]}
            links.append(participants)
        match = {"$or": links}
        if calls_only:
            match["action"] = "agent_call"
        cursor = self.db.audit_log.find(match).sort([("t", DESCENDING), ("_id", DESCENDING)]).limit(limit)
        return [_r(d) for d in reversed(list(cursor))]

    def audit_counts(self):
        return {"calls": self.db.audit_log.count_documents({"action": "agent_call"}),
                "errors": self.db.audit_log.count_documents({"action": "agent_call", "payload.status": "error"})}

    # snapshot. engine.tick() calls save() every round; writes already
    def put_case(self, case: dict) -> None:
        self.db.security_cases.replace_one({"_id": case["id"]}, _w(case), upsert=True)

    def list_cases(self) -> list[dict]:
        return [_r(d) for d in self.db.security_cases.find()]

    # persisted, so there is nothing to flush.
    def save(self, path: str | None = None) -> None:
        return None

    def close(self) -> None:
        self.client.close()
