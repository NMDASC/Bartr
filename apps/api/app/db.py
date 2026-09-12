"""Mongo connection. Owner: Vir.

Two consumers with different needs, so there are two accessors:

  get_db()      synchronous, lazy, always returns a handle. This is what
                `migrate.py` and any script uses.
  require_db()  FastAPI dependency; raises 503 when the server is unreachable
                so a stub endpoint can still answer while mongo is down.

No index or collection creation happens here. That belongs to `migrations/`,
which is the single source of truth for schema (see docs/DECISIONS.md 006).
The app boots with mongo down; only endpoints that touch data fail.
"""

import logging

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

log = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_reachable = False


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=3000)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    """The database handle. Synchronous and lazy, so scripts can call it at import time."""
    return get_client()[get_settings().mongodb_db]


async def close_client() -> None:
    global _client, _reachable
    if _client is not None:
        _client.close()
    _client, _reachable = None, False


async def ping() -> bool:
    """Check connectivity and cache the result for /health and /readiness."""
    global _reachable
    try:
        await get_client().admin.command("ping")
        _reachable = True
    except Exception as exc:  # noqa: BLE001 - degraded mode is intentional
        log.warning("mongo unreachable (%s); stub endpoints still serve", exc)
        _reachable = False
    return _reachable


def is_reachable() -> bool:
    return _reachable


async def require_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency for endpoints that actually read or write data."""
    if not _reachable and not await ping():
        raise HTTPException(
            status_code=503,
            detail="database unavailable; run 'docker compose up -d mongo' or set MONGODB_URI",
        )
    return get_db()
