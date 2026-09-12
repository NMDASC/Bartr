"""Forward-only migration runner.

Mongo has no schema, so a migration here is not an ALTER TABLE. It is the three
things Mongo does need pinned down: indexes, the Atlas Search index, and the few
documents the app assumes already exist. Collections themselves are created
implicitly by the first index or insert, so we never create them by hand.

Every migration exposes `async def up(db)` and must be safe to run twice, because
four people will run this against four databases at different times.

    uv run python migrate.py status
    uv run python migrate.py up
    uv run python migrate.py reset --yes   # drop everything, then re-apply
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType

from app.db import close_client, get_db

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
LOG_COLLECTION = "_migrations"


def _load(path: Path) -> ModuleType:
    # Loaded by path rather than imported, so the files can keep numeric names.
    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load migration {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _discover() -> list[tuple[str, ModuleType]]:
    return [(p.stem, _load(p)) for p in sorted(MIGRATIONS_DIR.glob("[0-9]*.py"))]


async def _applied(db) -> set[str]:
    return {doc["_id"] async for doc in db[LOG_COLLECTION].find({}, {"_id": 1})}


async def cmd_status() -> None:
    db = get_db()
    applied = await _applied(db)
    print(f"database: {db.name}\n")
    for name, module in _discover():
        mark = "applied" if name in applied else "PENDING"
        summary = (module.__doc__ or "").strip().splitlines()[0] if module.__doc__ else ""
        print(f"  [{mark:>7}]  {name}  {summary}")


async def cmd_up() -> None:
    db = get_db()
    applied = await _applied(db)
    pending = [(n, m) for n, m in _discover() if n not in applied]
    if not pending:
        print(f"{db.name}: up to date")
        return
    for name, module in pending:
        print(f"applying {name} ...", flush=True)
        await module.up(db)
        await db[LOG_COLLECTION].insert_one(
            {"_id": name, "applied_at": datetime.now(timezone.utc)}
        )
    print(f"{db.name}: applied {len(pending)} migration(s)")


async def cmd_reset(assume_yes: bool) -> None:
    db = get_db()
    if not assume_yes:
        answer = input(f"Drop every collection in '{db.name}'? Type the db name to confirm: ")
        if answer.strip() != db.name:
            print("aborted")
            return
    for name in await db.list_collection_names():
        await db.drop_collection(name)
    print(f"{db.name}: dropped")
    await cmd_up()


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    sub.add_parser("up")
    reset = sub.add_parser("reset")
    reset.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = parser.parse_args()

    try:
        if args.command == "status":
            await cmd_status()
        elif args.command == "up":
            await cmd_up()
        elif args.command == "reset":
            await cmd_reset(args.yes)
    finally:
        await close_client()
    return 0


if __name__ == "__main__":
    from app.env import load_env

    load_env()  # same loader the API uses, so both see the same database
    sys.exit(asyncio.run(main()))
