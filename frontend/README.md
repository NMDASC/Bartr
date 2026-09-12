# Bartr frontend

Next.js 16 (App Router), Tailwind v4, TypeScript. Owner: A.

## Run

```
pnpm i
pnpm dev          # http://localhost:3000, mock mode
pnpm build        # the check that matters before merging to main
```

## Modes

| `NEXT_PUBLIC_API_URL` | Data |
|---|---|
| unset | `packages/contracts/examples/*.json` plus an in-browser simulator (`src/lib/mock.ts`) that runs the 8.3 batch auction, the 8.1 owner ladder and floor, and the 8.2b belief update every 10s. Orders you place rest in the book and fill. |
| set, e.g. `http://localhost:8000` | FastAPI at `{url}/api/v1`, WebSocket at `{url}/ws/markets/{id}`. Contract in `packages/contracts/types.ts`. |

Everything goes through `src/lib/api.ts`. No screen imports fixtures or fetch directly.

## Live discovery

Set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` in `frontend/.env.local` and restart the
existing development server. Put `QUERIT_API_KEY`, `XAI_API_KEY`, and `DISCOVERY_LIVE=1`
in the repository root `.env` for the API. Provider keys must never use `NEXT_PUBLIC_`.
Search uses POST `/api/v1/discovery/search` followed by replayable SSE. The shared
GraphQL API is available separately; screens continue to use the existing API adapter.

Pittsburgh is the first city shortcut, followed by NYC, Miami, Chicago, San Francisco,
Los Angeles, Boston and Seattle. Other U.S. cities can be typed directly, preferably
as `business type in City, ST`. NYC/SF aliases and common city spellings are normalized
on the backend. Changing cities resets the input and results; required location and
budget constraints never relax automatically.

Jobs retain partial results when a provider fails. The UI distinguishes complete,
partial and failed searches, resolves unfinished rows, and retries without overlapping
subscriptions. Company pages display available source excerpts, retrieval dates and
field-level reported/estimated evidence. An API connection alone does not imply that
live retrieval is configured; check `/readiness`.

After configuring both providers, `python3 scripts/discover_cities.py` from the repository
root warms Pittsburgh, NYC, Miami, Chicago and San Francisco through the same API.
Use `--city 'Austin, TX' --category 'car wash'` for another search. Store persistence is
controlled by the API's Mongo configuration or `STATE_FILE`.

Verification: `node --test frontend/tests/search-state.test.mjs` from the repository
root (Node 22.18+), TypeScript checking, and browser checks against the running API.

## Routes

| Route | File | What it shows |
|---|---|---|
| `/` | `app/page.tsx` | hero, search, trending rows |
| `/search?q=` | `app/search/page.tsx` + `components/search/results.tsx` | streamed results, filter rail, `READING` chip on stubs |
| `/company/[id]` | `app/company/[id]/page.tsx` + `components/company/*` | price strip, countdown, step chart, order book, depth plate `BTR. 1.1`, order ticket, valuation estimators, sources |
| `/company/[id]/acquire` | `app/company/[id]/acquire/page.tsx` | LOI, diligence checklist with citations |
| `/portfolio` | `app/portfolio/page.tsx` | cash, positions, half-Kelly suggestions with risk slider |
| `/surveillance` | `app/surveillance/page.tsx` | flags feed, per-reviewer severities, disputed marker |
| `/agent` | `app/agent/page.tsx` + `components/agent/chat.tsx` | chat with tool-call cards, same endpoint as iMessage |

## Design system

Lemma kinship. Tokens in `src/styles/lemma-tokens.css`, mapped into Tailwind's `@theme` in `src/app/globals.css`.
Rules that are not negotiable: light only, `border-radius: 0` everywhere, no `box-shadow`, sections separate with
`1px #D4D4DD` rules, secondary text is `#1D1956` at 65% (never a flat gray), every uppercase string is IBM Plex Mono
with 0.06 to 0.15em tracking, headings weight 400, and `#755CFE` marks state (clearing price, active path, plate
strokes), never importance. Bids `#2BC392`, asks `#EE5557`. Primitives in `src/components/ui`; no shadcn.

Britti Sans is licensed and not installed. The sans stack is `brittiSans, Geist, Arial`. IBM Plex Mono is real.

## Conventions

- **No explainer text in the UI.** Controls and data speak; mechanism lives here and in Plan.md. Cut any string
  that explains how something works, why a number is what it is, or what will happen when the user acts, plus
  formulas, architecture facts, and repeated reassurance. Keep labels, numbers, states, chart legends, one
  footer disclaimer. Test: would a team with no knowledge of the code have written this sentence?

- Prices per share are `px()` (2 decimals, no symbol). Whole-company values are `usd(n, { compact: true })`.
- `origin` on a book level is `user | treasury | bot | agent`. Treasury rows get the `OWNER` tag.
- Plate figures use the `BTR. x.y` prefix and must encode something real from live data.
- Any new field the UI needs goes into `packages/contracts/types.ts` with a `docs/DECISIONS.md` entry, not into a component.
