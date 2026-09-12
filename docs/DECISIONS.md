# Decisions (append only)

Format: `## NNN  Day HH:MM  author: X  affects: A,B,C,D` then what changed, why, and migration notes. Newest at the bottom. Post the number in the team chat after pushing.

## 001  Fri 21:00  author: Aditya (with Claude)  affects: all
Plan.md committed. Track: Optimization (backup Multiplayer). Stack: Next.js 15 + FastAPI + MongoDB Atlas + Auth0 + Vultr + Vercel. LLM via one `llm.py` with xai / ifm switch.

## 002  Fri 21:30  author: Aditya  affects: C, A
Black Scholes acquisition options are out of scope. Acquire = LOI + diligence checklist only.

## 003  Fri 22:00  author: Aditya  affects: C, A, D
No automated market maker. Liquidity comes from the owner (Treasury account): ask ladder for the float plus a buyback floor bid, both derived from the valuation posterior quantiles. The platform never trades. Avellaneda Stoikov moved to Backlog.md. `markets.mm` removed from the data model; `markets.treasury` gained `floor_price`, `floor_qty`, `ask_ladder`.

## 004  Fri 22:00  author: Aditya  affects: B, C
Initial pricing is now a Bayesian ensemble in log space (`valuation.py`): income (multiple x SDE), base rate (category median asking price, haircut to sold), proxy (revenue from observables), and LLM opinion, each with its own sigma, precision weighted, with disagreement inflation. Posterior (mu, sigma) feeds the Treasury quotes and Kelly. Benchmarks in `benchmarks.py` from BizBuySell 2026 tables.

## 005  Fri 21:30  author: A (Zhiyuan)  affects: B, C, D
Drafted `packages/contracts/types.ts` and nine fixtures in `packages/contracts/examples/` from Plan.md sections 6 and 7 so the frontend builds against real shapes before the freeze. PROPOSAL until 23:30. Additions the plan did not spell out: `DiscoveryEvent` union for the SSE job stream (`intent | company_stub | company_ready | company_failed | done`); `MarketEvent` union for `WS /ws/markets/{id}` (`book | batch | trade | flag | halt`); `CompanyCard` row shape with nullable prices while `status == "stub"`; `Book.levels[].origin` so the UI can tell owner liquidity from real orders; `Flag.reviews[]` plus `disputed` so Grok/K2 disagreement renders; `AgentChatRequest.session_id` is the Auth0 sub on web and an E.164 phone over iMessage. Updated after 003/004: `origin` is `user | treasury | bot | agent`, `markets.treasury` and `belief` replace `mm`, `valuation.estimates[]` replaces `comps[]`.

## 006  Fri 22:05  author: A  affects: D
iMessage is IN scope and lives in `apps/imessage`, not `scripts/imessage_bridge.py`. Photon Spectrum managed line (no Mac, no Full Disk Access, deploys to Railway) instead of polling `chat.db`; Plan.md 9.5 route 1 is superseded. The bridge calls `POST /api/v1/agent/chat` with `session_id = <sender phone>` and `X-Demo-User: <sender phone>`, accepts JSON `{content, tool_calls?}` or plain text. Replies must be short lines, no markdown. Photon Free tier: max 10 users, DMs only. D: keep `/agent/chat` non-streaming or JSON-terminal.

## 007  Fri 22:15  author: A  affects: all
Frontend lives at `frontend/` (repo root), not `apps/web`. Stack drift from Plan.md section 4: Next.js 16.3, Tailwind v4, no shadcn/ui (its defaults fight the square-corner, no-shadow design system; primitives are hand written in `frontend/src/components/ui`). `lightweight-charts` v5 step line for price. Mock mode (`NEXT_PUBLIC_API_URL` unset) runs fixtures plus an in-browser reference implementation of the 8.3 auction and the 8.1 Treasury ladder/floor in `frontend/src/lib/mock.ts`; it is not the engine. Design system: Lemma kinship (light only, zero radius, no shadows, hairline rules, IBM Plex Mono labels, one indigo accent on state). Ownership line in CLAUDE.md should read `A: frontend, apps/imessage`.
## 008  Fri 23:30  author: Aditya  affects: A, B, D
Backend API is live in `apps/api` (see its README). Routes under `/api/v1`: companies, markets (book, orders, batches, trades, ws), portfolio (+ Kelly suggest), surveillance. Demo auth via `X-Demo-User`. Storage goes through `app/store.py::Store`; the simulated DB should implement that protocol and be constructed in `app/deps.py`. Book and cards carry `indicative_price` (what the round would clear at right now) because bids can sit above asks between rounds. Opening trades tiebreak toward the model reference price, not the midpoint.
Limit up/down: if the band clamps the clearing price and nothing can trade at the band edge, the reference price steps to the edge with zero volume (`batch.ref_moved = true`) so the band walks toward resting interest next round instead of deadlocking. Belief update runs only on real volume.

## 009  Sat 00:30  author: Aditya  affects: A, B, D
API output now matches `packages/contracts/types.ts` exactly (A's 005 draft): `_id`, ISO `Z` timestamps, `Book.levels[].origin`, `Book.band{pct,low,high}`, `Portfolio.pnl{realized,unrealized,total}`, `Suggestion.company{...}`, `Batch.imbalance`, `Flag.reviews[]/disputed`. Extras the API adds beyond the draft (harmless to TS): `Book.indicative_price`, `CompanyCard.indicative_price`, `Batch.band_hit/ref_moved`, `Belief.model_value/market_value`, `Company.observables`, `Portfolio.user_id/reserved_cash/equity`. WebSocket is `WS /ws/markets/{id}` at the app root, not under `/api/v1`. `packages/contracts/openapi.json` is exported from the app; types.ts stays hand maintained by A (regenerating would change its import shape).
Local stand-ins so the frontend runs against the real API today, each replaced by its owner without changing routes or shapes: `POST /discovery/search` + SSE `GET /discovery/jobs/{id}` (keyword intent parser over seeded companies; B swaps in Grok + Places + Querit), `POST /acquire/{id}/start` (templated LOI + state/category checklist, no citations; D swaps in Grok web_search), `GET /surveillance/flags` (rules layer only: wash pair, pump, concentration, band; D adds Grok and K2 reviews). Verified: `frontend` builds with `NEXT_PUBLIC_API_URL` set, every route renders backend data, WS pushes `book` and `batch` frames.

## 010  Sat 00:05  author: A  affects: D
No disclaimer line in the generated LOI or anywhere in the UI. Plan.md 9.6 says "A disclaimer line: play money, not legal advice"; that line is removed from the LOI fixture and from every screen, footer, and the iMessage help text. Nothing user-facing says play money, demo, mock, or not-advice. Also: the ensemble numbers, auction rules, and Kelly formula stay out of the UI (no captions or helper sentences explaining mechanism); see the UI-copy line in CLAUDE.md.

## 010  Sat 00:50  author: Aditya  affects: A, B, D
Demo is Pittsburgh. Seeds are now 10 Pittsburgh area businesses (Squirrel Hill, Bloomfield, Lawrenceville, McKnight Rd, McKees Rocks, Greenfield, South Side, Homestead, Strip District, Oakland) plus two out of state controls (Tulsa, Waco). Company ids changed: `co_squirrel_hill_wash` is the hero. Discovery intent parser is city aware ("laundromat in Pittsburgh" -> city Pittsburgh, state PA; Homestead and McKees Rocks count as metro). Acquire checklist adds City of Pittsburgh registration and Allegheny County Health Department items. Plan.md section 13 and docs/PROMPT_presentation.md updated. A: the fixtures in packages/contracts/examples still reference Oklahoma; swap when convenient.
