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

## 005  Fri 22:10  author: Vir  affects: all
API skeleton landed. Every endpoint in Plan.md section 7 exists and returns the matching file from `packages/contracts/examples/`, validated against its `response_model`, so a malformed example fails pytest instead of the frontend at 3 AM. Owners replace the function body and keep the signature; stubs carry a `TODO(owner)` marker.

Also landed: `schemas.py` (the contract), `db.py`, `llm.py` (the xai / ifm switch, the only module that imports `openai`), `ws.py` (in process websocket hub, single worker), `identity.py`, `main.py`, `Dockerfile`, `docker-compose.yml` (api + local mongo), `scripts/gen_contract.sh`, `openapi.yaml` and `types.ts`.

`Valuation` in `schemas.py` mirrors the dataclass in `valuation.py` (v0, sigma, low, high, estimates, disagreement, method) so the API and the ensemble cannot drift. The contract has no options endpoints, per 002. `MarketSummary` exposes the top of book only; the Treasury ladder is not a separate contract type.

Python is pinned to `>=3.11,<3.13`: `sentence-transformers` has no wheels above 3.12 and at least one of our machines runs 3.14. `pyproject.toml` keeps the dependency set from origin plus `pydantic-settings`, `sse-starlette` and `pyyaml`, and moves dev deps to `[dependency-groups]` so plain `uv run pytest` works. `numpy` and `scipy` are not dependencies: nothing imports them, and `valuation.py` and `auction.py` are deliberately stdlib only.

Migration: `cd apps/api && uv sync`, then `uv run uvicorn app.main:app --reload`. `GET /readiness` reports which keys are live. The API boots with no `.env` and with mongo down.

## 006  Fri 22:15  author: Vir  affects: all
Auth0 is not wired, by decision. Demo auth (`DEMO_AUTH=1`, header `X-Demo-User`) is the only implemented path, and it is also the demo day path for judges, so it is the one that gets tested all night rather than a second class fallback. `/readiness` reports `auth0: false`.

The `users` shape from migration `001_users.py` is kept: `name` unique, `auth0_sub` sparse unique. Two things are added so a demo session can become a real account later, both in migration `006_identity.py`:

- `users.email`, normalized (trimmed, lowercased), sparse unique.
- `users.display_name`, the human readable label, because `name` is an identity key and cannot also be a display field (two judges called "vir" would collide).

Resolution order in `identity.py`: match `auth0_sub`, else match `email` and attach the sub to that user, else match `name`, else create. The email step is what makes a demo session claimable, so signing in later with the same address inherits the cash, positions and orders built under it. Judges who type a bare name still work, they just cannot be linked later.

Consequence everyone must respect: every row referencing a person stores `users._id`, never `name` and never a subject string. That is what lets a demo identity become a real account without rewriting `orders`, `positions`, `trades` or `flags`. Do not branch on `auth_provider` outside `identity.py`.

Indexes and seed documents are created only by `migrate.py`, never at application startup, so there is one source of truth for schema. Run `uv run python migrate.py up` after pulling.

Migration: none for existing data, the collections are empty. Send `X-Demo-User: vir@example.com` on any write.
