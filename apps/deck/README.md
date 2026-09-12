# Bartr demo deck

`index.html` is the deck. Single file, no build step. Open it in Chrome.

## Present

1. `open apps/deck/index.html` in Chrome, press `F` for full screen.
2. Keys: `→` `space` next (reveals the second beat on slide 2 first), `←` back, `Home`, `End` returns to the public close, `Q` jumps to the internal Q&A appendix, `P` presenter clock (starts when you leave slide 1, turns white at 2:50), `R` replays the two rounds on slide 9, `Esc` leaves full screen. Clicking the right two thirds of the screen also advances.
3. `#8` in the URL jumps to a slide. The deck scales to any window (tested 1920x1080 and 1440x900).
4. Slide 9 plays on its own when you land on it: two rounds, about 30 seconds. Traders quote from their cards, each quote flies into the book, the countdown hits zero, demand and supply draw, the clearing price snaps in, fills flash, the price chart gets a point, the model value updates and the owner requotes the ladder and floor from it. In round 2 a holder sells. It runs the real clearing rule and the real belief update (same constants as `engine.py`) on the real opening book from `scripts/demo_pricing.py`.
5. Stop the public presentation on the close slide (`End`). Slides after that are an internal Q&A appendix covering market, owners, competition, valuation, the Kelly paper, liquidity, regulation, investor rights, business model, technical truth and security. Press `Q` from any slide to open it.
6. If Chrome dies, `Bartr.pdf` has the 16 public slides followed by the 12-slide Q&A appendix. `Bartr.pptx` is the same as images with the talk track and Q&A prompts in the notes.

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
| 6 | `assets/search.png` | `/search?q=laundromat+in+pittsburgh` |
| 6 | `assets/company.png` | `/company/co_squirrel_hill_wash` |
| 11 (unused now, the slide is an animated card) | `assets/portfolio.png` | `/portfolio` (the portfolio page is server rendered as user `server`; seed positions for that user first, and push a few markets below model value so Suggested stakes is not empty) |
| 12 | `assets/acquire.png` | `/company/co_squirrel_hill_wash/acquire` |

Sponsor logos are in `assets/logos/` (simple-icons, CC0). No xAI, IFM or Querit mark exists there, so those are wordmarks.

Then rerun `./apps/deck/export.sh` to refresh the PDF and pptx.

## Talk track (3:00, keep moving)

| Time | Slide | Say |
|---|---|---|
| 0:00 | 1 Title | "The laundromat on Murray Avenue is worth $570,768, give or take 22 percent. Today you can buy 20 shares of it. That is Bartr." |
| 0:08 | 2 36 million | "Who here is from CMU? Who's eaten at Grapow? Ever thought about putting money into it? There's no way to. Thirty-six million small businesses in this country." |
| 0:16 | 3 80 percent | "And when the owner retires, four out of five that try to sell never find a buyer. They shut down. Most of them are profitable. They close because nobody can write a check for the whole thing, and nobody's allowed to buy part of it." |
| 0:26 | 4 Half the workforce | "These places employ half the American workforce. This isn't a niche. It's the economy." |
| 0:32 | 5 Who and what | "We connect buyers and sellers. Owners sell 30 percent and keep running the place. Investors buy 20 shares with a price and a way out. Acquirers get the owner's ear and a letter of intent." |
| 0:40 | 6 Discover | "Type laundromat in Pittsburgh. Places, Querit, Grok. Every number keeps the sentence it came from. 53 real businesses priced." |
| 0:47 | 7 How search works | "Our proprietary search helps you discover underground, undervalued companies. Grok reads the brief. Places lists every business in the city. Querit finds twelve pages and reads the best six. Grok turns pages into profiles where every figure keeps its sentence and its URL. Ranked by evidence, valued five ways, on the page as it happens." |
| 0:58 | 8 One company | "Squirrel Hill Wash and Fold: $570,768, range 475 to 686 thousand." |
| 0:58 | 9 Pricing | "Five ways to value it, each with its own typical miss. Weighted by one over the miss squared. Each method is a bit off and they disagree; we add both. A range, never a bare number." |
| 1:12 | 10 Market | "The owner is the seller. Five lots above our value, a buyback below. Every round, one price for everyone, and the owner requotes from the updated value." |
| 1:25 | 11 Live | Let two rounds run. "Everyone paid 58.67, including Jonas who bid 64.20. Round two: the value moved, the owner requoted, Jonas sold part of his stake at the same price the new buyers paid." |
| 1:55 | 12 Fairness | "One price, no head start. Price check, no self trades, size limits, a 10 percent band, proportional fills, an audit log." |
| 2:05 | 13 Portfolio | "Every suggestion shows the gap. Kelly sizes the stake. The slider is your risk: move it and the gain and the possible loss move with it." |
| 2:12 | 14 Kelly board | "We derived the fraction on the board. Maximize log wealth, then take half because the edge is estimated." |
| 2:17 | 15 Acquire | "From 20 shares to the whole company: an LOI at the last price and a Pittsburgh checklist with the official forms." |
| 2:26 | 16 Security | "Rules catch it, two models judge it separately, and Grok tries to beat it as red team." |
| 2:38 | 17 Grok | "Every company is appraised twice: Grok researches and names a value, K2 names one blind, both go into the price." |
| 2:48 | 18 Stack | "Next.js, FastAPI, Atlas, Places, Querit, Grok, K2, iMessage. 103 tests." |
| 2:55 | 19 Close | "The laundromat on Murray Avenue has a price. Buy 20 shares, watch the next round." |

## Files

- `index.html` the deck
- `Bartr.pdf` fallback, 16 pages, 16:9
- `Bartr.pptx` fallback, slide images with notes
- `export.sh` regenerates both with headless Chrome (`pptx.js` builds the pptx, needs node)
- `assets/` screenshots, logos, QR, Kelly board photo, Kelly derivation PDF
