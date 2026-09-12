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
| POST | /discovery/search | `{q}` -> 202 `{job_id, intent}`; ranks seeds, live pipeline if `DISCOVERY_LIVE=1` |
| GET | /discovery/jobs/{id} | SSE: `intent`, `company_stub`, `company_ready`, `done` |
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

## Layout

```
app/main.py                     app, scheduler (ticks markets, steps bots)
app/deps.py                     store, engine, hub singletons; demo auth
app/schemas.py                  API contract (changes need a DECISIONS.md entry)
app/views.py                    engine dicts -> contract shapes (_id, ISO timestamps)
app/store.py                    Store protocol + MemoryStore (swap in the simulated DB / Atlas here)
app/services/discovery/         valuation.py (ensemble), benchmarks.py
app/services/market/            auction.py, treasury.py, kelly.py, engine.py, hub.py, bots.py
app/routers/                    companies, discovery, market, ws, portfolio, acquire, surveillance
seeds/companies.json            8 demo companies
tests/                          auction, valuation, engine, API
```

## Plugging in a different store

Implement the methods in `app/store.py::Store` (plain dicts in, plain dicts out) and construct it in `app/deps.py`. The engine never touches storage any other way.
