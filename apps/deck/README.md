# Bartr demo deck

`index.html` is the deck. Single file, no build step. Open it in Chrome.

## Present

1. `open apps/deck/index.html` in Chrome, press `F` for full screen.
2. Keys: `→` `space` next (reveals the second beat on slide 2 first), `←` back, `Home` `End`, `P` presenter clock (starts when you leave slide 1, turns white at 2:50), `R` replays the marketplace on slide 8, `Esc` leaves full screen. Clicking the right two thirds of the screen also advances.
3. `#8` in the URL jumps to a slide. The deck scales to any window (tested 1920x1080 and 1440x900).
4. Slide 8 plays on its own when you land on it: three rounds, about 25 seconds. Traders quote from their cards, each quote flies into the book, the countdown hits zero, demand and supply draw, the clearing price snaps in, fills flash, the price chart gets a point, the model value updates and the owner requotes the ladder and floor from it. In round 3 a holder sells. It runs the real clearing rule and the real belief update (same constants as `engine.py`) on the real opening book from `scripts/demo_pricing.py`.
5. If Chrome dies, `Bartr.pdf` has the same 15 slides at their final state. `Bartr.pptx` is the same as images with the talk track in the notes.

Fonts: SF Pro on a Mac, Inter from Google Fonts otherwise. KaTeX loads from cdnjs. Both need network once; after that Chrome caches them. Open the deck once on the venue wifi before we go up.

## Screenshots

Real captures of the frontend live in `assets/` (1440x900, taken from `next start` against the local API with seeds and bots). To refresh them:

```
cd apps/api && SEED=1 BOTS=1 .venv/bin/uvicorn app.main:app --port 8000
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8000 npx next build && NEXT_PUBLIC_API_URL=http://localhost:8000 npx next start -p 3005
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --hide-scrollbars --window-size=1440,900 --virtual-time-budget=20000 --screenshot=apps/deck/assets/search.png "http://localhost:3005/search?q=laundromat+in+pittsburgh"
```

| Slide | File | Route |
|---|---|---|
| 4 | `assets/search.png` | `/search?q=laundromat+in+pittsburgh` |
| 5 | `assets/company.png` | `/company/co_squirrel_hill_wash` |
| 10 | `assets/portfolio.png` | `/portfolio` (the portfolio page is server rendered as user `server`; seed positions for that user first, and push a few markets below model value so Suggested stakes is not empty) |
| 11 | `assets/acquire.png` | `/company/co_squirrel_hill_wash/acquire` |
| 8, 15 | `assets/qr.png` | QR of the live site, still a placeholder |

Sponsor logos are in `assets/logos/` (simple-icons, CC0). No xAI, IFM or Querit mark exists there, so those are wordmarks.

Then rerun `./apps/deck/export.sh` to refresh the PDF and pptx.

## Talk track (3:00, 15 slides, keep moving)

| Time | Slide | Say |
|---|---|---|
| 0:00 | 1 Title | "Bartr. Discover, exchange, acquire. A price and a market for the businesses nobody lists." |
| 0:06 | 2 Problem | "33 million small businesses. Almost none has a price." Beat. "If you wanted to buy a laundromat in Squirrel Hill tonight, you could not even find the list." |
| 0:18 | 3 What Bartr is | "For a buyer: a price with an error bar, then 20 shares, then the keys. For an owner: cash for 30 percent, keep the keys, no bank." |
| 0:30 | 4 Discover | "Type laundromat in Pittsburgh. Places finds them, Querit reads the web, Grok extracts a profile where every number carries its quote. The ensemble prices it with a range." |
| 0:44 | 5 One company | "Squirrel Hill Wash and Fold. 571 thousand, plus or minus 22 percent. Live book, countdown, order ticket." |
| 0:54 | 6 Pricing | "Five methods, each with a measured miss. Blend them, trusting the tighter ones. Doubt has two parts: the methods' own error and how much they disagree. We show a range, never a bare number." |
| 1:08 | 7 Market | "The owner is the seller. An ask ladder for 30 percent just above the model value, a buyback floor at P20. Every round, one price for everyone. Between rounds the owner requotes from the updated model." |
| 1:22 | 8 Live | "Scan the QR and bid." Let three rounds run. "One price per round. The owner requotes. In round three a holder sells to new buyers at the same price." |
| 1:48 | 9 Anti arbitrage | "One price, no head start. Clamp, self trade check, limits, a ten percent band, pro rata fills, an append only audit log. Speed buys nothing." |
| 2:00 | 10 Portfolio | "Find the edge, size it, keep an exit. Model value next to market price, your own Kelly dial, and the owner's buyback bid standing in every book." |
| 2:12 | 11 Acquire | "From a share to the whole company. An LOI at the last clearing price and a Pittsburgh checklist that links to the official sources." |
| 2:22 | 12 Security | "Rules scan every trade. Every flag goes to Grok and to K2 separately. If they disagree, we show it." |
| 2:34 | 13 Grok | "Grok reads the web, but we keep a number only if its quote is in the page. Grok gives a valuation opinion with its own doubt, reviews flags, and runs the agent." |
| 2:46 | 14 Stack | "Next.js, FastAPI, MongoDB Atlas, Places, Querit, Grok, K2, an iMessage bridge to the same agent." |
| 2:55 | 15 Close | "Bartr. Discover. Exchange. Acquire." |

## Files

- `index.html` the deck
- `Bartr.pdf` fallback, 15 pages, 16:9
- `Bartr.pptx` fallback, slide images with notes
- `export.sh` regenerates both with headless Chrome (`pptx.js` builds the pptx, needs node)
- `assets/` screenshots, logos, QR
