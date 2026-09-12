# Bartr demo deck

`index.html` is the deck. Single file, no build step. Open it in Chrome.

## Present

1. `open apps/deck/index.html` in Chrome, press `F` for full screen.
2. Keys: `→` `space` next (reveals the second beat on slide 2 first), `←` back, `Home` `End`, `P` presenter clock (starts when you leave slide 1, turns white at 2:50), `R` replays the two rounds on slide 8, `Esc` leaves full screen. Clicking the right two thirds of the screen also advances.
3. `#8` in the URL jumps to a slide. The deck scales to any window (tested 1920x1080 and 1440x900).
4. Slide 8 plays on its own when you land on it: two rounds, about 30 seconds. Traders quote from their cards, each quote flies into the book, the countdown hits zero, demand and supply draw, the clearing price snaps in, fills flash, the price chart gets a point, the model value updates and the owner requotes the ladder and floor from it. In round 2 a holder sells. It runs the real clearing rule and the real belief update (same constants as `engine.py`) on the real opening book from `scripts/demo_pricing.py`.
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
| 15 | `assets/qr.png` | QR of the live site, still a placeholder |

Sponsor logos are in `assets/logos/` (simple-icons, CC0). No xAI, IFM or Querit mark exists there, so those are wordmarks.

Then rerun `./apps/deck/export.sh` to refresh the PDF and pptx.

## Talk track (3:00, 15 slides)

| Time | Slide | Say |
|---|---|---|
| 0:00 | 1 Title | "The laundromat on Murray Avenue is worth $570,768, give or take 22 percent. Today you can buy 20 shares of it. That is Bartr." |
| 0:08 | 2 Problem | "33 million small businesses. Almost none has a price. Want a laundromat in Squirrel Hill? There is no list, and nothing you find has a number next to it." |
| 0:20 | 3 What Bartr is | "Buyers see what a shop is worth, buy 20 shares, or buy all of it. Owners sell 30 percent to the crowd and keep running it." |
| 0:32 | 4 Discover | "Type laundromat in Pittsburgh. Places finds them, Querit reads the web, Grok turns the pages into a profile where every number keeps the sentence it came from." |
| 0:45 | 5 One company | "Squirrel Hill Wash and Fold: $570,768, range 475 to 686 thousand. $57.08 a share." |
| 0:55 | 6 Pricing | "Five ways to value it, each with its own typical miss. Weighted by one over the miss squared. Two things go wrong, each method is a bit off and they disagree, we add both. A range, never a bare number." |
| 1:10 | 7 Market | "The owner is the seller. Five lots just above our value, a buyback bid below it. Every round, one price for everyone. Our value updates from what buyers paid, and the owner's quotes move with it." |
| 1:25 | 8 Live | Let two rounds run. "Everyone in the round paid 58.67, including Jonas who bid 64.20. Round two: our value moved, the owner requoted, Jonas sold part of his stake at the same price the new buyers paid." |
| 1:55 | 9 Fairness | "One price, no head start. Price check, no trading with yourself, size limits, a 10 percent band, proportional fills, an audit log. Being fast buys nothing." |
| 2:07 | 10 Portfolio | "Every suggestion shows the gap between our value and the price. Kelly turns that into a stake. The slider is your risk level: move it and the gain and the possible loss move with it." |
| 2:20 | 11 Acquire | "From 20 shares to the whole company: a letter of intent at the last price and a Pittsburgh checklist that links to the official forms." |
| 2:30 | 12 Security | "Rules scan every trade. Grok and K2 review every flag separately. Grok also attacks the market as red team so the rules get tested." |
| 2:42 | 13 Grok | "Every company is appraised twice: Grok researches and names a value, K2 names one without seeing Grok's, both go into the price." |
| 2:52 | 14 Stack | "Next.js, FastAPI, Atlas, Places, Querit, Grok, K2, iMessage. 103 tests." |
| 2:57 | 15 Close | "The laundromat on Murray Avenue has a price. Scan, buy 20 shares, watch the next round." |

## Files

- `index.html` the deck
- `Bartr.pdf` fallback, 15 pages, 16:9
- `Bartr.pptx` fallback, slide images with notes
- `export.sh` regenerates both with headless Chrome (`pptx.js` builds the pptx, needs node)
- `assets/` screenshots, logos, QR
