#!/usr/bin/env bash
# Copy the deck into the frontend's static folder so Vercel serves it at /deck/ on the next push to main.
set -euo pipefail
cd "$(dirname "$0")/.."
rsync -a --delete --exclude .stills --exclude export.sh --exclude pptx.js --exclude .gitignore --exclude README.md apps/deck/ frontend/public/deck/
echo "frontend/public/deck updated; commit and push main, then https://bartr-hackcmu.vercel.app/deck/"
