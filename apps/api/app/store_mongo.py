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

    def ping(self) -> bool:
        try:
            self.client.admin.command("ping")
            return True
        except Exception:  # noqa: BLE001 - callers only need the boolean
            return False

    # companies
    def put_company(self, c: dict) -> None:
        self.db.companies.replace_one({"_id": c["id"]}, _w(c), upsert=True)

    def get_company(self, cid: str) -> dict | None:
        return _r(self.db.companies.find_one({"_id": cid}))

    def list_companies(self) -> list[dict]:
        return [_r(d) for d in self.db.companies.find()]

    # markets
    def put_market(self, m: dict) -> None:
        self.db.markets.replace_one({"_id": m["id"]}, _w(m), upsert=True)

    def get_market(self, mid: str) -> dict | None:
        return _r(self.db.markets.find_one({"_id": mid}))

    def list_markets(self) -> list[dict]:
        return [_r(d) for d in self.db.markets.find()]

    # orders
    def put_order(self, o: dict) -> None:
        self.db.orders.replace_one({"_id": o["id"]}, _w(o), upsert=True)

    def get_order(self, oid: str) -> dict | None:
        return _r(self.db.orders.find_one({"_id": oid}))

    def open_orders(self, mid: str) -> list[dict]:
        cur = self.db.orders.find({"market_id": mid, "status": {"$in": ["open", "partial"]}})
        return [_r(d) for d in cur]

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

    # users
    def get_user(self, uid: str) -> dict | None:
        return _r(self.db.users.find_one({"_id": uid}))

    def put_user(self, u: dict) -> None:
        self.db.users.replace_one({"_id": u["id"]}, _w(u), upsert=True)

    def find_user_by_email(self, email: str) -> dict | None:
        return _r(self.db.users.find_one({"email": email}))

    def list_users(self) -> list[dict]:
        return [_r(d) for d in self.db.users.find()]

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

    # snapshot. engine.tick() calls save() every round; writes already
    # persisted, so there is nothing to flush.
    def save(self, path: str | None = None) -> None:
        return None

    def close(self) -> None:
        self.client.close()
