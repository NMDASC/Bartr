#!/usr/bin/env bash
# Export the frozen API contract. Run after any change to app/schemas.py or a
# route signature, then add a docs/DECISIONS.md entry and commit as "contract:".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/packages/contracts"

echo "==> exporting openapi.yaml"
cd "$ROOT/apps/api"
uv run python -c "
import yaml
from app.main import app
spec = app.openapi()
with open('$OUT/openapi.yaml', 'w') as f:
    yaml.safe_dump(spec, f, sort_keys=False, width=100)
print('   ', len(spec.get('paths', {})), 'paths')
"

echo "==> generating types.ts"
cd "$OUT"
if command -v pnpm >/dev/null 2>&1; then
  pnpm dlx openapi-typescript openapi.yaml -o types.ts
else
  npx --yes openapi-typescript openapi.yaml -o types.ts
fi

echo "==> done. Commit with prefix 'contract:' and log it in docs/DECISIONS.md"
