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

## 005  Fri 23:30  author: Aditya  affects: A, B, D
Backend API is live in `apps/api` (see its README). Routes under `/api/v1`: companies, markets (book, orders, batches, trades, ws), portfolio (+ Kelly suggest), surveillance. Demo auth via `X-Demo-User`. Storage goes through `app/store.py::Store`; the simulated DB should implement that protocol and be constructed in `app/deps.py`. Book and cards carry `indicative_price` (what the round would clear at right now) because bids can sit above asks between rounds. Opening trades tiebreak toward the model reference price, not the midpoint.
Limit up/down: if the band clamps the clearing price and nothing can trade at the band edge, the reference price steps to the edge with zero volume (`batch.ref_moved = true`) so the band walks toward resting interest next round instead of deadlocking. Belief update runs only on real volume.
