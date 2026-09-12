#!/usr/bin/env bash
# One-shot Atlas setup. Run this from a real terminal (not from an agent), because
# the login step is a device-code flow that needs an interactive TTY.
#
#   ./scripts/setup_atlas.sh
#
# Creates a free M0 cluster named "jb", a database user, an open IP allowlist,
# writes MONGODB_URI into .env, and applies the migrations. Safe to re-run.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER="jb"
DBUSER="jb_app"
PWFILE="$REPO/.atlas_password"

cd "$REPO"

if ! command -v atlas >/dev/null 2>&1; then
  echo "atlas CLI not found. Run: brew install mongodb-atlas-cli"
  exit 1
fi

# 1. Login ------------------------------------------------------------------
if ! atlas auth whoami >/dev/null 2>&1; then
  echo "==> Logging in to Atlas. Pick 'UserAccount', then approve in the browser."
  atlas auth login
else
  echo "==> Already logged in as: $(atlas auth whoami 2>&1)"
fi

# 2. Password ---------------------------------------------------------------
# Alphanumeric only, so it never needs URL encoding inside the connection string.
if [ ! -f "$PWFILE" ]; then
  python3 -c "
import secrets, string
print('jb' + ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20)))
" > "$PWFILE"
  chmod 600 "$PWFILE"
fi
DBPASS="$(cat "$PWFILE")"

# 3. Cluster ----------------------------------------------------------------
# A project gets exactly one free cluster, so reuse whatever is already there.
# Creating a second M0 fails with CANNOT_CREATE_FREE_CLUSTER_VIA_PUBLIC_API,
# which reads like an API restriction but really means "you already have one".
EXISTING="$(atlas clusters list --output json 2>/dev/null | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin)["results"][0]["name"])
except Exception:
    print("")
')"

if [ -n "$EXISTING" ]; then
  CLUSTER="$EXISTING"
  echo "==> Using existing cluster '$CLUSTER'"
else
  echo "==> Creating free M0 cluster '$CLUSTER' (takes 3-7 minutes)"
  atlas clusters create "$CLUSTER" --provider AWS --region US_EAST_1 --tier M0
fi

# 4. Database user ----------------------------------------------------------
# readWriteAnyDatabase, not a collection-scoped role: anything narrower cannot
# create the vector search index in migration 005.
if atlas dbusers describe "$DBUSER" >/dev/null 2>&1; then
  echo "==> Rotating password for existing user '$DBUSER'"
  atlas dbusers update "$DBUSER" --password "$DBPASS" >/dev/null
else
  echo "==> Creating database user '$DBUSER'"
  atlas dbusers create --username "$DBUSER" --password "$DBPASS" \
    --role readWriteAnyDatabase >/dev/null
fi

# 5. Network access ---------------------------------------------------------
echo "==> Allowlisting 0.0.0.0/0 (hackathon wifi changes IPs; tighten later)"
atlas accessLists create 0.0.0.0/0 --type cidrBlock \
  --comment "hackathon" >/dev/null 2>&1 || echo "    (already present)"

# 6. Wait for the cluster to come up ----------------------------------------
echo "==> Waiting for cluster to reach IDLE"
atlas clusters watch "$CLUSTER"

# 7. Connection string ------------------------------------------------------
RAW="$(atlas clusters connectionStrings describe "$CLUSTER" --output json | python3 -c '
import json, sys
print(json.load(sys.stdin)["standardSrv"])
')"
HOST="${RAW#mongodb+srv://}"
URI="mongodb+srv://${DBUSER}:${DBPASS}@${HOST}/?retryWrites=true&w=majority&appName=${CLUSTER}"

# 8. Write it into .env -----------------------------------------------------
[ -f .env ] || cp .env.example .env
python3 - "$URI" <<'PY'
import pathlib, sys
uri = sys.argv[1]
p = pathlib.Path(".env")
lines = p.read_text().splitlines()
out, seen = [], False
for line in lines:
    if line.startswith("MONGODB_URI="):
        out.append(f"MONGODB_URI={uri}")
        seen = True
    else:
        out.append(line)
if not seen:
    out.append(f"MONGODB_URI={uri}")
p.write_text("\n".join(out) + "\n")
print("==> wrote MONGODB_URI into .env")
PY

# 9. Migrations -------------------------------------------------------------
echo "==> Applying migrations"
cd apps/api
uv sync --quiet
uv run python migrate.py up
uv run python migrate.py status

echo
echo "Done. Cluster '$CLUSTER' is live and .env points at it."
echo "The db password is in .atlas_password (gitignored). Share it with the team"
echo "over Discord along with MONGODB_URI so everyone uses the same cluster."
