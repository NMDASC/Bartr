# JB (HackCMU 2026)

Read `Plan.md` once per session (sections 7 and 8 first), and `docs/DECISIONS.md` every time before you change a schema, route, shared type, or db collection.

Before starting work: `git pull --rebase`.

Ownership (do not edit another owner's directory; append a request to `docs/DECISIONS.md` instead):
- A: `frontend` (web app, demo), `apps/imessage` (Photon Spectrum bridge)
- B: `apps/api/app/services/discovery`, `apps/api/app/routers/{discovery,companies}.py`, `apps/api/seeds`
- C: `apps/api/app/services/market`, `apps/api/app/routers/market.py`, websocket hub, `apps/api/tests`
- D: `apps/api/app/llm.py`, `apps/api/app/services/agents`, `apps/api/app/routers/{portfolio,acquire,agent,surveillance}.py`, deploy, `docs/`

Any change to `packages/contracts`, `apps/api/app/schemas.py`, or a db collection shape requires:
1. an entry in `docs/DECISIONS.md` (id, time, author, what changed, who must react),
2. regenerating `packages/contracts/openapi.yaml` and `types.ts`,
3. a commit message starting with `contract:`.

Commit small and often on your own branch (`a/`, `b/`, `c/`, `d/` prefixes); merge to `main` only when `pytest apps/api/tests` passes. Never force push `main`.

Keys live in `.env` (never committed). `.env.example` lists every variable.

Grok and K2 are used only through API calls inside the app (extraction, valuation opinions, compliance review, chat agent). Do not use them to write code.

Writing style for docs and UI copy: no em dashes, no filler.

## API conventions

- Storage goes through `app/store.py::Store`. `MemoryStore` is the default; set `MONGODB_URI` and `app/deps.py` swaps in `app/store_mongo.py::MongoStore`. The protocol is synchronous, so the mongo implementation uses pymongo, not motor. Do not reach past the store from a router or the engine.
- Indexes, the Atlas search index and seed documents live in `migrations/` and are applied by `uv run python migrate.py up`. Never create an index at application startup. `app/db.py` exists only to give that runner an async handle.
- Identity: `app/identity.py` normalizes `X-Demo-User` (a name, an email, or an E.164 phone) into the user id the engine uses, so one person cannot become two accounts through casing or phone formatting. Auth0 is not wired; do not branch on provider outside that module.
- `/agent/chat` returns a single JSON message, never a token stream, because the iMessage bridge cannot consume one (decision 006).
- All model calls go through `app/llm.py`. Nothing else imports `openai`.
- Stub routes are marked `TODO(owner)`: replace the body, keep the signature.
- Run the API with one uvicorn worker. The hub, the engine and the scheduler are in process singletons.
- `packages/contracts/types.ts` is hand authored and is the contract. `./scripts/gen_contract.sh` exports `openapi.yaml` as a cross check and does not touch `types.ts`.
