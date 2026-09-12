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

## Routes and workflows

See [the workspace guide](../docs/WORKSPACE_GUIDE.md) for route behavior,
administrator setup, iMessage, persistence and verification.

`/` is the personal overview. `/search` is business discovery. Business profiles begin
with Simple trading and reveal the full book, depth, tape and batches in Advanced.
`/portfolio` shows holdings and sizing, `/agent` shares the authenticated bridge's
conversation, and `/surveillance` is the administrator console. Acquisition drafts
are created explicitly and saved to the active session.

## Design system

The user-authorized redesign is documented in decision 019. Tokens now live in
`src/app/globals.css`: a paper background, white bordered panels, a navy navigation
shell, iris actions, green bids and red asks. Panels have a 14px radius and restrained
separation. Geist handles navigation and headings; IBM Plex Mono handles numeric
labels. The original Lemma token file is retained for reference.

Simple views lead with account status and the next useful action. Technical detail
belongs behind Advanced, disclosure controls or an investigation. Copy explains
unavailable data or consequential state transitions when it helps the user act.
Use real data; do not fabricate chart history, connection status or completed trades.

Dialogs use `components/ui/dialog.tsx` for a portal, Escape, focus containment and focus
restoration. Tables stay scrollable when dense; personal orders become cards on phones.
Respect reduced motion and preserve visible keyboard focus.

## Conventions

- All transport calls go through `src/lib/api.ts`.
- Fetch personal data in client components with the current normalized identity.
- Put shared fields in `packages/contracts/types.ts` and document them in `DECISIONS.md`.
- Per-share values use `px()`; whole business values use `usd()`.
- Source labels distinguish owner, user, bot and agent liquidity.
- Secrets stay on the API or bridge. Administrator tokens are entered by the user and held in memory.
