# JB demo deck

`index.html` is the deck. Single file, no build step. Open it in Chrome.

## Present

1. `open apps/deck/index.html` in Chrome, press `F` for full screen.
2. Keys: `→` `space` next (reveals the second beat on slide 2 first), `←` back, `Home` `End`, `P` presenter clock (starts when you leave slide 1, turns white at 2:50), `R` replays the auction on slide 7, `Esc` leaves full screen. Clicking the right two thirds of the screen also advances.
3. `#7` in the URL jumps to a slide. The deck scales to any 16:9 or 16:10 window (tested 1920x1080 and 1440x900).
4. Slide 7 plays on its own when you land on it: bids arrive during the countdown, then the curves draw, the clearing price snaps in and the fills flash. About 7 seconds. It is the real algorithm from slide 6 running in JS on a real book (owner ladder and floor from `scripts/demo_pricing.py`, round 2).
5. If Chrome dies, `JB.pdf` has the same 12 slides at their final state. `JB.pptx` is the same as images with the talk track in the notes.

Fonts: SF Pro on a Mac, Inter from Google Fonts otherwise. KaTeX loads from cdnjs. Both need network once; after that Chrome caches them. Open the deck once on the venue wifi before we go up.

## Screenshots (drop in at 1 PM Saturday)

Each placeholder is a 1440x900 frame with a `<!-- SCREENSHOT: route -->` comment above it. Save a 1440x900 PNG (or any 16:10 capture) into `assets/` with the exact name and it appears in the frame with no other change:

| Slide | File | Route | What to show |
|---|---|---|---|
| 3 | `assets/search.png` | `/search?q=laundromat+in+pittsburgh` | results streaming in: Squirrel Hill Wash and Fold, Butler Street Laundromat, Bloomfield Coin Laundry |
| 4 | `assets/company.png` | `/company/co_squirrel_hill_wash` | profile, sources, the five estimators, valuation range bar |
| 8 | `assets/portfolio.png` | `/portfolio` | four Kelly sized suggestions |
| 9 | `assets/acquire.png` | `/company/co_squirrel_hill_wash/acquire` | LOI draft and the Pittsburgh checklist with citations |
| 7, 12 | `assets/qr.png` | live site | square QR, any size |

Then rerun `./apps/deck/export.sh` to refresh the PDF and pptx.

## Talk track (3:00)

| Time | Slide | Say |
|---|---|---|
| 0:00 | 1 Title | "JB. A stock market for the businesses that will never be listed." |
| 0:05 | 2 Problem | "33 million small businesses in the US. None of them has a price." Beat. "If you wanted to buy a laundromat in Squirrel Hill tonight, you could not even find the list." |
| 0:20 | 3 Discover | "Type laundromat in Pittsburgh. Places finds the businesses, Querit reads the web about each one, Grok extracts a profile with cited sources. Results stream in with a bid, an ask and a confidence." |
| 0:40 | 4 One company | "Squirrel Hill Wash and Fold. Sources, five independent estimators, and a range, not a number: 475 to 686 thousand." |
| 0:55 | 5 Pricing | "Each estimator is a belief about log value with its own uncertainty. Precision weighted, inflated when they disagree, calibrated on real listings with the price hidden. The owner's floor and ask ladder are quantiles of the same posterior." |
| 1:15 | 6 Clearing | "Every ten seconds we run a uniform price auction and clear at the volume maximizing price. One price, no speed advantage, pro rata rationing, a price band, and the valuation updates from every round. The platform never trades." |
| 1:30 | 7 Live | "Scan the QR and bid." Let the batch clear. "Bids came in, countdown hit zero, demand met supply at 60.76, everyone trades at that price, the owner sold from the ladder." |
| 1:55 | 8 Portfolio | "Given your profile, four stakes sized by half Kelly on the gap between model value and market price." |
| 2:10 | 9 Acquire | "From a share to the whole company. A drafted LOI and a Pittsburgh specific diligence checklist: city registration, Allegheny County Health Department, PA bulk sale clearance. Every item cited." |
| 2:30 | 10 Surveillance | "Every round, two model families read the tape. A planted wash trade: Grok flags it, K2 concurs. Independent review, immutable audit log." |
| 2:45 | 11 Stack | "Grok, IFM K2, Querit, MongoDB Atlas Vector Search, Auth0, Vultr, Vercel. Next.js and FastAPI, built in Cursor. Track: Optimization." |
| 2:55 | 12 Close | "JB. Price everything." |

## Files

- `index.html` the deck
- `JB.pdf` fallback, 12 pages, 16:9
- `JB.pptx` fallback, slide images with notes
- `export.sh` regenerates both with headless Chrome (`pptx.js` builds the pptx, needs node)
- `assets/` screenshots and QR go here
