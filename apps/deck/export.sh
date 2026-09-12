#!/usr/bin/env bash
# Regenerates JB.pdf (and, if node is around, JB.pptx) from index.html. Run from anywhere.
set -euo pipefail
cd "$(dirname "$0")"
CH="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
URL="file://$PWD/index.html"
"$CH" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 \
  --print-to-pdf="$PWD/JB.pdf" "$URL?print" >/dev/null 2>&1
echo "wrote JB.pdf"
if command -v node >/dev/null; then
  mkdir -p .stills
  for n in $(seq 1 12); do
    "$CH" --headless=new --disable-gpu --hide-scrollbars --window-size=1920,1080 --virtual-time-budget=8000 \
      --screenshot="$PWD/.stills/s$n.png" "$URL?slide=$n&still" >/dev/null 2>&1
  done
  if [ ! -d .stills/node_modules/pptxgenjs ]; then (cd .stills && npm init -y >/dev/null 2>&1 && npm i pptxgenjs@3 >/dev/null 2>&1); fi
  NODE_PATH=.stills/node_modules node pptx.js && echo "wrote JB.pptx"
fi
