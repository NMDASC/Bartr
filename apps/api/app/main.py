"""JB API. Run: uvicorn app.main:app --reload (from apps/api).

Env: SEED=1 loads seeds/companies.json at startup, BOTS=1 runs demo bot traders,
STATE_FILE=data/state.json persists the in-memory store, DEMO_AUTH=1 accepts X-Demo-User.
"""
from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.deps import engine, store
from app.routers import acquire, companies, discovery, market, portfolio, surveillance, ws

SEED = os.getenv("SEED", "1") == "1"
BOTS = os.getenv("BOTS", "0") == "1"
TICK_S = float(os.getenv("TICK_S", "1.0"))
SEED_FILE = Path(__file__).resolve().parent.parent / "seeds" / "companies.json"


def load_seeds() -> int:
    if not SEED_FILE.exists() or store.list_companies():
        return 0
    n = 0
    for c in json.loads(SEED_FILE.read_text()):
        engine.create_company(c)
        n += 1
    return n


async def scheduler(stop: asyncio.Event):
    bots = None
    if BOTS:
        from app.services.market.bots import Bots
        bots = Bots(engine)
    i = 0
    while not stop.is_set():
        try:
            engine.tick()
            if bots and i % 3 == 0:
                bots.step()
        except Exception as e:  # keep the loop alive during the demo
            print("scheduler error:", repr(e))
        i += 1
        await asyncio.sleep(TICK_S)


@asynccontextmanager
async def lifespan(app: FastAPI):
    n = load_seeds() if SEED else 0
    print(f"seeded {n} companies; markets: {len(store.list_markets())}; bots: {BOTS}")
    stop = asyncio.Event()
    task = asyncio.create_task(scheduler(stop))
    yield
    stop.set()
    task.cancel()


app = FastAPI(title="JB API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

API = "/api/v1"
app.include_router(companies.router, prefix=API)
app.include_router(discovery.router, prefix=API)
app.include_router(market.router, prefix=API)
app.include_router(portfolio.router, prefix=API)
app.include_router(acquire.router, prefix=API)
app.include_router(surveillance.router, prefix=API)
app.include_router(ws.router)  # /ws/markets/{id} at the root, per the contract


@app.get("/health")
def health():
    return {"ok": True, "companies": len(store.list_companies()), "markets": len(store.list_markets())}
