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
