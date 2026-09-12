# Bartr demo deck

`index.html` is the deck. Single file, no build step. Open it in Chrome.

## Present

1. `open apps/deck/index.html` in Chrome, press `F` for full screen.
2. Keys: `→` `space` next (reveals the second beat on slide 2 first), `←` back, `Home` `End`, `P` presenter clock (starts when you leave slide 1, turns white at 2:50), `R` replays the marketplace on slide 8, `Esc` leaves full screen. Clicking the right two thirds of the screen also advances.
3. `#8` in the URL jumps to a slide. The deck scales to any window (tested 1920x1080 and 1440x900).
4. Slide 8 plays on its own when you land on it: traders quote from their cards, each quote flies into the book, the countdown hits zero, demand and supply draw, the clearing price snaps in, fills flash and the buyers light up. About 9 seconds. It runs the real clearing rule from slide 7 on a real book (owner ladder and floor from `scripts/demo_pricing.py`, round 2).
5. If Chrome dies, `Bartr.pdf` has the same 14 slides at their final state. `Bartr.pptx` is the same as images with the talk track in the notes.

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
| 8, 14 | `assets/qr.png` | QR of the live site, still a placeholder |

Sponsor logos are in `assets/logos/` (simple-icons, CC0). No xAI, IFM or Querit mark exists there, so those are wordmarks.

Then rerun `./apps/deck/export.sh` to refresh the PDF and pptx.

## Talk track (3:00)

| Time | Slide | Say |
|---|---|---|
| 0:00 | 1 Title | "Bartr. Discover, exchange, acquire. The first stock market for the businesses that will never be listed." |
| 0:06 | 2 Problem | "33 million small businesses. None of them has a price." Beat. "If you wanted to buy a laundromat in Squirrel Hill tonight, you could not even find the list." |
| 0:18 | 3 What Bartr is | "One place to find a small business, own a piece of it, and buy the whole thing. Nobody has built that exchange before." |
| 0:30 | 4 Discover | "Type laundromat in Pittsburgh. Places finds them, Querit reads the web, Grok extracts a cited profile, the ensemble prices it with a range." |
| 0:45 | 5 One company | "Squirrel Hill Wash and Fold. 571 thousand, 475 to 686. Live book, countdown, order ticket." |
| 0:55 | 6 Pricing | "Every piece of evidence is its own estimate with its own uncertainty. Precision weighted, wider when they disagree, calibrated on real listings." |
| 1:08 | 7 Market | "The owner is the other side. An ask ladder for 30 percent at P55 to P80, a buyback floor at P20. Every ten seconds, one price for everyone. The platform never trades." |
| 1:22 | 8 Live | "Scan the QR and bid." Let it clear. "One price for all four buyers, the owner sold from the ladder." |
| 1:45 | 9 Anti arbitrage | "Fair by construction. Clamp, self trade check, limits, one uniform price, a ten percent band, pro rata fills, audit log. Speed buys nothing." |
| 1:58 | 10 Portfolio | "Built for you to make money. Edge on every suggestion, your own Kelly dial, always an exit at the floor. We are never your counterparty." |
| 2:12 | 11 Acquire | "From a share to the whole company. LOI and a Pittsburgh checklist, every item cited." |
| 2:24 | 12 Security | "Every trade is reviewed by a panel of AI agents. Rules, Grok, K2. The planted wash trade gets flagged, explained, frozen." |
| 2:38 | 13 Stack | "Next.js on Vercel, FastAPI on Vultr, Atlas Vector Search, Auth0, Places, Querit, Grok, K2. Built in Cursor. Track: Optimization." |
| 2:52 | 14 Close | "Bartr. Discover. Exchange. Acquire." |

## Files

- `index.html` the deck
- `Bartr.pdf` fallback, 14 pages, 16:9
- `Bartr.pptx` fallback, slide images with notes
- `export.sh` regenerates both with headless Chrome (`pptx.js` builds the pptx, needs node)
- `assets/` screenshots, logos, QR
