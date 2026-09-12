#!/usr/bin/env bash
# Copy the deck into the frontend's static folder so Vercel serves it at /deck on the next push to main.
# Vercel serves the page at /deck (no trailing slash), so relative asset paths would resolve one level up;
# the published copy uses absolute /deck/assets/... paths. apps/deck/index.html keeps relative paths for file://.
set -euo pipefail
cd "$(dirname "$0")/.."
rsync -a --delete --exclude .stills --exclude export.sh --exclude pptx.js --exclude .gitignore --exclude README.md apps/deck/ frontend/public/deck/
sed -i '' -e 's#src="assets/#src="/deck/assets/#g' -e 's#href: `assets/logos/#href: `/deck/assets/logos/#g' -e "s#href=\"assets/#href=\"/deck/assets/#g" frontend/public/deck/index.html
echo "frontend/public/deck updated; commit and push main, then https://bartr-hackcmu.vercel.app/deck"
