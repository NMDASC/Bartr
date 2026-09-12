"""Mongo connection and index setup. Owner: Vir.

The app boots even when Mongo is unreachable; `get_db` then raises 503 and the
stub endpoints that serve contract examples keep working. This keeps the
frontend and the market pair unblocked before Atlas exists.
"""

import logging

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT

from .config import get_settings

log = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect() -> None:
    global _client, _db
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=3000)
    try:
        await _client.admin.command("ping")
    except Exception as exc:  # noqa: BLE001 - degraded mode is intentional
        log.warning("mongo unreachable (%s); running without a database", exc)
        _db = None
        return
    _db = _client[settings.mongodb_db]
    await ensure_indexes(_db)
    log.info("mongo connected: db=%s", settings.mongodb_db)


async def disconnect() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client, _db = None, None


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Indexes from Plan.md section 6, plus the identity indexes from DECISIONS 001."""
    await db.users.create_index([("auth_subs", ASCENDING)], unique=True, sparse=True)
    await db.users.create_index([("email", ASCENDING)], unique=True, sparse=True)
    await db.companies.create_index([("name", TEXT), ("description", TEXT), ("category", TEXT)])
    await db.companies.create_index([("state", ASCENDING), ("category", ASCENDING)])
    await db.orders.create_index([("market_id", ASCENDING), ("status", ASCENDING)])
    await db.trades.create_index([("market_id", ASCENDING), ("t", DESCENDING)])
    await db.batches.create_index([("market_id", ASCENDING), ("t", DESCENDING)])
    await db.positions.create_index([("user_id", ASCENDING), ("market_id", ASCENDING)], unique=True)
    await db.flags.create_index([("t", DESCENDING)])
    await db.audit_log.create_index([("t", DESCENDING)])


def db_or_none() -> AsyncIOMotorDatabase | None:
    return _db


async def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise HTTPException(
            status_code=503,
            detail="database unavailable; start mongo (docker compose up mongo) or set MONGODB_URI",
        )
    return _db
