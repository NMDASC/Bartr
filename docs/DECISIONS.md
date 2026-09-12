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
