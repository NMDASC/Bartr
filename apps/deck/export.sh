#!/usr/bin/env bash
# Regenerates Bartr.pdf (and, if node is around, Bartr.pptx) from index.html. Run from anywhere.
set -euo pipefail
cd "$(dirname "$0")"
CH="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
URL="file://$PWD/index.html"
"$CH" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 \
  --print-to-pdf="$PWD/Bartr.pdf" "$URL?print" >/dev/null 2>&1
echo "wrote Bartr.pdf"
if command -v node >/dev/null; then
  mkdir -p .stills
  for n in $(seq 1 32); do
    "$CH" --headless=new --disable-gpu --hide-scrollbars --window-size=1920,1080 --virtual-time-budget=8000 \
      --screenshot="$PWD/.stills/s$n.png" "$URL?slide=$n&still" >/dev/null 2>&1
  done
  BUNDLED_NODE="/Users/Home/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  BUNDLED_MODULES="/Users/Home/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"
  if [ -x "$BUNDLED_NODE" ] && [ -d "$BUNDLED_MODULES/pptxgenjs" ]; then
    NODE_PATH="$BUNDLED_MODULES" "$BUNDLED_NODE" pptx.js && echo "wrote Bartr.pptx"
  else
    if [ ! -d .stills/node_modules/pptxgenjs ]; then (cd .stills && npm init -y >/dev/null 2>&1 && npm i pptxgenjs@3 >/dev/null 2>&1); fi
    NODE_PATH=.stills/node_modules node pptx.js && echo "wrote Bartr.pptx"
  fi
fi
