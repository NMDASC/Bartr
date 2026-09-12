"""Loader for packages/contracts/examples/*.json. Owner: Vir.

Stub routes return these, so every endpoint in Plan.md section 7 answers with a
correctly shaped body from hour 0. Each route declares a `response_model`, so
FastAPI validates the example on the way out and a malformed example fails the
smoke test rather than the frontend.
"""

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
EXAMPLES_DIR = Path(
    os.getenv("CONTRACTS_EXAMPLES_DIR", REPO_ROOT / "packages" / "contracts" / "examples")
)


@lru_cache(maxsize=None)
def example(name: str) -> Any:
    path = EXAMPLES_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"missing contract example: {path}")
    return json.loads(path.read_text())
