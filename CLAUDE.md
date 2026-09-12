# JB (HackCMU 2026)

Read `Plan.md` once per session (sections 7 and 8 first), and `docs/DECISIONS.md` every time before you change a schema, route, shared type, or db collection.

Before starting work: `git pull --rebase`.

Ownership is at the file level inside a pair and the directory level between pairs (Plan.md section 10). Do not edit the other pair's directory; append a request to `docs/DECISIONS.md` instead.

- Market pair, Nico and Aditya: `apps/api/app/services/market`, `apps/api/app/routers/market.py`, the websocket hub, `apps/api/app/services/agents/{compliance,portfolio_agent}.py`, `apps/api/tests`
- Platform pair, Vir and Zhiyuan: `apps/web`, `packages/contracts`, `apps/api/app/services/discovery`, `apps/api/app/routers/{discovery,companies,portfolio,acquire,agent,surveillance}.py`, `db.py`, `identity.py`, `llm.py`, `migrations/`, `seeds/`, deploy, `docs/`

Any change to `packages/contracts`, `apps/api/app/schemas.py`, or a db collection shape requires:
1. an entry in `docs/DECISIONS.md` (id, time, author, what changed, who must react),
2. regenerating `packages/contracts/openapi.yaml` and `types.ts` (`./scripts/gen_contract.sh`),
3. a commit message starting with `contract:`.

Commit small and often on your own branch (`nico/`, `aditya/`, `vir/`, `zhiyuan/` prefixes); merge to `main` only when `pytest` passes. Never force push `main`.

Keys live in `.env` (never committed). `.env.example` lists every variable.

Grok and K2 are used only through API calls inside the app (extraction, valuation opinions, compliance review, chat agent). Do not use them to write code.

Writing style for docs and UI copy: no em dashes, no filler.

## API conventions

Every route in Plan.md section 7 already exists as a stub returning `packages/contracts/examples/*.json`, validated against its `response_model`. Replace the body, keep the signature. Stubs carry a `TODO(owner)` marker.

- Prices are floats in the contract. The engine dataclasses in `services/market/auction.py` use `limit` and `seq`; the router maps between them.
- All model calls go through `app/llm.py`. Nothing else imports `openai`.
- Indexes and seed documents live in `migrations/`, never in application startup. `migrate.py` is the only thing that creates them.
- Identity: every row referencing a person stores `users._id`, never a name or a subject string. Auth is demo only right now; do not branch on provider outside `app/identity.py`.
- Run the API with one uvicorn worker. The websocket hub and the batch scheduler are in process singletons.

## Commands

```
cd apps/api && uv sync                              # install
cd apps/api && uv run uvicorn app.main:app --reload # dev server on :8000
cd apps/api && uv run pytest                        # tests
cd apps/api && uv run python migrate.py up          # indexes, search index, seed docs
docker compose up -d mongo                          # local database
./scripts/gen_contract.sh                           # regenerate openapi.yaml and types.ts
curl localhost:8000/readiness                       # what is actually wired up
```
