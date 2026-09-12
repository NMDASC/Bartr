"""Load the repo root .env into os.environ. Owner: Vir.

Without this, setting MONGODB_URI in .env would silently do nothing to the API
(uvicorn does not read .env) and you would be on the in-memory store while
believing you were on Atlas. `migrate.py` and `app/deps.py` both call it, so
one file configures both.

No python-dotenv dependency: the format we use is one KEY=value per line.
Real shell environment always wins, so `MONGODB_URI=... uvicorn ...` still
overrides the file.
"""

from __future__ import annotations

import os
from pathlib import Path

_loaded = False


def load_env(path: Path | None = None) -> None:
    global _loaded
    if _loaded:
        return
    _loaded = True

    env = path or Path(__file__).resolve().parents[3] / ".env"
    if not env.exists():
        return

    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        # Strip surrounding quotes. An Atlas URI is usually pasted with them,
        # and a literal leading quote makes pymongo reject the scheme with an
        # error that never mentions quoting.
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)
