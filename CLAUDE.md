# JB (HackCMU 2026)

Read `docs/STEERING.md` once per session, and `docs/DECISIONS.md` every time before you change a schema, route, or shared type.

Before starting work: `git pull --rebase`.

## Ownership

- `app/services/market/` + `app/routers/market.py` + `compliance.py` + `portfolio_agent.py` = **Nico & Aditya** (market pair)
- `apps/web/` + `packages/contracts/` + `app/services/discovery/` + `db.py` + `llm.py` + `identity.py` + deploy = **Vir & Zhiyuan** (platform pair)

Do not edit the other pair's directory; append a request to `docs/DECISIONS.md` instead. Inside a pair, see `Plan.md` section 10 for the file-level split.

## Contract changes

Any change to `packages/contracts/`, `apps/api/app/schemas.py`, or a Mongo collection requires:

1. an entry in `docs/DECISIONS.md` with id, time, author, what changed, who must react;
2. regenerating `openapi.yaml` and `types.ts` (`./scripts/gen_contract.sh`);
3. a commit prefixed `contract:`.

## Conventions

- Every route in `Plan.md` section 7 already exists as a stub returning `packages/contracts/examples/*.json`. Replace the body, keep the signature. Stubs are marked `TODO(owner)`.
- Prices are floats in the contract, `Decimal` inside the matching engine. Convert at the boundary.
- All model calls go through `app/llm.py`. Nothing else imports `openai`.
- Identity: every row referencing a person uses `users._id`, never a subject string. Auth is demo-only right now; do not branch on provider anywhere outside `app/identity.py`.
- Run the API with **one uvicorn worker**. The WebSocket hub and batch scheduler are in-process singletons.
- Commit small and often to your own branch (`nico/`, `aditya/`, `vir/`, `zhiyuan/`). Merge to `main` only when tests pass. Never force-push `main`.
- Keys live in `.env`, never committed. `.env.example` lists every variable and who is fetching it.

## Commands

```
cd apps/api && uv sync                              # install (pins Python 3.12)
cd apps/api && uv run uvicorn app.main:app --reload # dev server on :8000
cd apps/api && uv run pytest                        # smoke tests
docker compose up mongo                             # local database
./scripts/gen_contract.sh                           # regenerate openapi.yaml + types.ts
curl localhost:8000/readiness                       # what is actually wired up
```
