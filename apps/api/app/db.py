"""Async mongo handle for the migration runner only. Owner: Vir.

This is NOT how the app reads or writes data. Runtime access goes through
`app/store.py::Store`, implemented for mongo by `app/store_mongo.py` with
pymongo, because the engine and the Store protocol are synchronous.

Migrations are `async def up(db)` and use `await db.x.create_index(...)`, so
`migrate.py` needs a motor handle. Keeping that here means the two drivers
never meet: motor for schema, pymongo for data.
"""

from __future__ import annotations

import os

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient | None = None


def get_db() -> AsyncIOMotorDatabase:
    """Synchronous and lazy, so migrate.py can call it at the top of a command."""
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI") or "mongodb://localhost:27017"
        _client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    return _client[os.getenv("MONGODB_DB", "jb")]


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
