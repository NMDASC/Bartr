# JB API

FastAPI service: valuation ensemble, batch auction exchange, owner liquidity, Kelly suggestions, audit log.

```
cd apps/api
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"     # or: pip install fastapi "uvicorn[standard]" pydantic pytest httpx websockets
.venv/bin/python -m pytest -q                                   # 24 tests
SEED=1 BOTS=1 .venv/bin/uvicorn app.main:app --reload            # http://localhost:8000/docs
```

Env: `SEED=1` loads `seeds/companies.json` (default on). `BOTS=1` runs 20 demo traders plus a planted wash pair. `STATE_FILE=data/state.json` persists the in-memory store across restarts. `DEMO_AUTH=1` (default) accepts `X-Demo-User: <name>`; any name gets 100,000 play dollars.

## Routes (all under /api/v1)

| Method | Path | Notes |
|---|---|---|
| POST | /companies | body = CompanyIn (profile + observables). Runs the ensemble, opens the market |
| GET | /companies?state=&category=&q=&sort= | cards with v0, sigma, best bid/ask, indicative price |
| GET | /companies/{id} | profile, valuation with every estimator, market state |
| POST | /companies/valuation/preview | run the ensemble without creating anything |
| GET | /markets/{id} | belief (model vs market value), treasury (ladder, floor, proceeds) |
| GET | /markets/{id}/book | aggregated bids/asks incl. owner quotes, indicative clearing price, next_batch_at |
| POST | /markets/{id}/orders | `{side, qty, limit_price}`; 422 with the reason on rejection |
| GET | /markets/{id}/orders/mine | |
| DELETE | /markets/orders/{oid} | |
| GET | /markets/{id}/batches?snapshot= | price history, one row per round (`ref_moved` marks limit up/down steps) |
| GET | /markets/{id}/trades | tape |
| POST | /markets/{id}/batch/run | clear a round now (demo) |
| WS | **/ws/markets/{id}** (app root, not under /api/v1) | frames `book`, `batch`, `halt` |
| POST | /discovery/search | `{q, live?, limit?}` -> 202 `{job_id, intent}`; starts a reusable job; live defaults to `DISCOVERY_LIVE=1` |
| GET | /discovery/jobs/{id} | Replayable SSE with `Last-Event-ID`: `intent`, `ranking`, `company_ready`, `done`; terminal status/warnings preserve partial results |
| GET | /portfolio | cash, positions, equity, pnl {realized, unrealized, total} |
| POST | /portfolio/suggest | half Kelly over markets; `own_values` overrides the model value per market |
| POST | /acquire/{company_id}/start | LOI markdown + state/category checklist with PA/Pittsburgh citations |
| GET | /surveillance/flags?market_id= | rules flags; Grok and K2 reviews attach when those keys are set |
| POST | /agent/chat | JSON `{content, tool_calls?}`; searches, orders, Kelly when asked |
| GET | /surveillance/audit?actor= | append only log |
| GET | /surveillance/treasury | owner proceeds and buybacks per market |

Shapes match `packages/contracts/types.ts`. `packages/contracts/openapi.json` is exported from the app (`python -c "import json; from app.main import app; print(json.dumps(app.openapi()))"`).

## Run with the frontend

```
cd apps/api && SEED=1 BOTS=1 .venv/bin/uvicorn app.main:app --port 8000
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8000 pnpm dev
```

## Grok and K2 (all through `app/llm.py`, all with a fallback when no key is set)

| Feature | Route | Grok does | Without a key |
|---|---|---|---|
| Appraiser | `POST /companies/{id}/appraise` | web_search research, structured value + sources; K2 second number; feeds the ensemble's `llm` estimator; re-anchors an untraded market | 503 |
| Intent | `POST /discovery/search` | structured parse of the query | keyword parser |
| Owner persona | `POST /companies/{id}/ask` | answers as the owner, grounded in the file, `grounded=false` when it strays | template answers |
| Narrator | `GET /markets/{id}/narrative` | two lines of tape commentary per cleared round | null |
| Profile | `POST /portfolio/profile/parse` | free text -> RiskProfile (drives filters and Kelly multiplier in `suggest`) | neutral profile |
| Suggest why | `POST /portfolio/suggest` | one sentence per pick in the user's terms | formula sentence |
| Compliance | `GET /surveillance/flags` | Grok and K2 grade each rules flag independently; `disputed` on disagreement | rules only |
| Red team | `POST /surveillance/redteam` | Grok picks and parameterizes an attack (wash, spoof, pump), executed through bot accounts; rules must catch it | random attack |
| Health memo | `GET /surveillance/report` | regulator style memo over the last hour | numeric summary |
| Acquire | `POST /acquire/{id}/start` | LOI drafted from the profile; checklist researched with web_search and cited | templates |
| Chat agent | `POST /agent/chat` | tool loop: search, company, book, place_order, suggest | first three companies |

`/readiness` lists `grok_features` and the last ten model calls. `scripts/grok_smoke.py` runs every feature once against real keys.

**Model tiers.** Interactive calls use `XAI_FAST_MODEL` (default `grok-4.20-0309-non-reasoning`, measured 0.7 to 2.2s per call); research with web_search uses `XAI_MODEL` (grok-4.6, 40 to 80s). The slow calls are cached ahead of the demo:
`scripts/appraise_seeds.py` (seeds -> `seeds/appraisals.json`, merged at boot; `--store` appraises every company in Atlas and writes back) and `scripts/warm_checklists.py` (per city/state/category -> `seeds/checklists.json`). Acquire returns the templated checklist instantly and swaps in the researched, cited one when it lands (`checklist_source`).

## Layout

```
app/main.py                     app, scheduler (ticks markets, steps bots)
app/deps.py                     store, engine, hub singletons; demo auth
app/schemas.py                  API contract (changes need a DECISIONS.md entry)
app/views.py                    engine dicts -> contract shapes (_id, ISO timestamps)
app/store.py                    Store protocol + MemoryStore (swap in the simulated DB / Atlas here)
app/services/discovery/         valuation.py (ensemble), benchmarks.py
app/services/market/            auction.py, treasury.py, kelly.py, engine.py, hub.py, bots.py
app/services/agents/            grok.py (wrapper, cache, fallbacks), appraiser, intent, compliance, narrator,
                                portfolio_agent, persona, redteam, acquire_agent, health, chat_agent
app/routers/                    companies, discovery, market, ws, portfolio, acquire, surveillance
seeds/companies.json            8 demo companies
tests/                          auction, valuation, engine, API
```

## Plugging in a different store

Implement the methods in `app/store.py::Store` (plain dicts in, plain dicts out) and construct it in `app/deps.py`. The engine never touches storage any other way.

## Workspace, messaging and security

See [WORKSPACE_GUIDE.md](../../docs/WORKSPACE_GUIDE.md) for the personal overview,
administrator access token, full audit archive, saved acquisition drafts, bridge
authentication and verification commands. New endpoints and storage additions are
recorded in decision 019.
