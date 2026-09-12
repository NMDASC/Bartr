# Decisions

Append only. Newest at the bottom. One entry per change to a shared interface:
`packages/contracts/`, `apps/api/app/schemas.py`, a Mongo collection, or a
cross-pair function signature. Format:

```
## NNN  <day HH:MM>  author: <name>  affects: <names>
What changed, in one or two sentences.
Migration: <what the affected people must do, or "none, additive">
```

---

## 001  Fri 22:10  author: Vir  affects: everyone
API skeleton landed. Every endpoint in `Plan.md` section 7 exists and returns
the matching file from `packages/contracts/examples/`, validated against its
`response_model`. Owners replace the function body and keep the signature;
stubs are marked `TODO(owner)`.

Also landed: `app/schemas.py` (the contract), `app/db.py` (Mongo + the section 6
indexes), `app/llm.py` (the `xai | ifm` provider switch), `app/ws.py` (the
in-process WebSocket hub), `app/identity.py` (demo auth), `Dockerfile` and
`docker-compose.yml`, and the coordination layer (`CLAUDE.md`,
`.cursor/rules/steering.mdc`, this file).

The contended models are deliberately thin. `Company`/`Financials`/`Valuation`/
`Source`/`Intent` carry only what the search and profile pages need to render;
`Order`/`Book`/`Batch`/`Trade` only what the ticket and chart need. Add fields
freely. Renaming or removing one needs an entry here.

Migration: `cd apps/api && uv sync`, then `uv run uvicorn app.main:app --reload`.
`GET /readiness` reports which keys are live. The API boots with no `.env` and
with Mongo down.

## 002  Fri 22:15  author: Vir  affects: everyone
Auth0 is not wired, by decision. Demo auth (`DEMO_AUTH=1`, header
`X-Demo-User`) is the only implemented path, which is also the demo-day path
for judges, so it is the one that gets tested all night rather than a
second-class fallback. `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` are reserved in
`.env.example` so the env surface will not change when it lands, and
`/readiness` reports `auth0: false`.

Storage shape is forward-compatible, so adding Auth0 later touches
`app/identity.py` only:

- `users.auth_subs` is an **array** of subject strings (`demo|a@b.com`,
  `auth0|65f3a1`), with a unique sparse index. This replaces the single
  `auth0_sub` field in `Plan.md` section 6.
- `users.email` is normalized (trimmed, lowercased) with a unique sparse index.
- Resolution order: match any linked subject, else match email and `$addToSet`
  the new subject onto that user, else create.

That middle step is what makes a demo session claimable: sign in later with the
same address and you inherit the cash, positions and orders built under it.
Judges who give a bare name instead of an email still work, they just cannot be
linked later.

Consequence everyone must respect: **every row referencing a person stores
`users._id`, never a subject string.** That is what lets a demo identity become
a real account without rewriting `orders`, `positions`, `trades` or `flags`. Do
not branch on `auth_provider` outside `app/identity.py`.

Migration: none, nothing consumed the old field yet. Send
`X-Demo-User: vir@example.com` on any write.
