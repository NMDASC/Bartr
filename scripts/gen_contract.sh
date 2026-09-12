#!/usr/bin/env bash
# Export the OpenAPI spec from the running app's route signatures.
#
# This deliberately does NOT generate packages/contracts/types.ts. That file is
# hand authored (decision 005) and is the contract the frontend was built
# against, so generating over it would silently drop the DiscoveryEvent and
# MarketEvent unions and the nullable-while-stub card fields that FastAPI has
# no way to express. openapi.yaml is the cross check: if a route signature and
# types.ts disagree, one of them is wrong and it goes in DECISIONS.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/packages/contracts/openapi.yaml"

cd "$ROOT/apps/api"
# Importing the app builds the store. Force the in-memory one so exporting the
# contract works offline and never depends on a cluster being reachable.
export MONGODB_URI="" STATE_FILE="" SEED=0 BOTS=0
uv run python -c "
import yaml
from app.main import app
spec = app.openapi()
with open('$OUT', 'w') as f:
    yaml.safe_dump(spec, f, sort_keys=False, width=100)
print(f'  {len(spec[\"paths\"])} paths -> packages/contracts/openapi.yaml')
"

echo "==> done. If a shape moved, log it in docs/DECISIONS.md and prefix the commit 'contract:'"
