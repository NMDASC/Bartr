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

from app.deps import STORE_KIND, engine, store
from app.routers import acquire, agent, companies, discovery, market, offers, portfolio, surveillance, ws
from app.routers.graphql import router as graphql_router
from app.routers import dashboard, security_console

SEED = os.getenv("SEED", "1") == "1"
BOTS = os.getenv("BOTS", "0") == "1"
TICK_S = float(os.getenv("TICK_S", "1.0"))
SEED_FILE = Path(__file__).resolve().parent.parent / "seeds" / "companies.json"


APPRAISALS_FILE = SEED_FILE.parent / "appraisals.json"


def load_seeds() -> int:
    """Seeds plus cached Grok appraisals (scripts/appraise_seeds.py), so the ensemble's `llm`
    estimator is real at boot and the company page shows the appraisal without a live call."""
    if not SEED_FILE.exists() or store.list_companies():
        return 0
    appraisals = json.loads(APPRAISALS_FILE.read_text()) if APPRAISALS_FILE.exists() else {}
    n = 0
    for c in json.loads(SEED_FILE.read_text()):
        a = appraisals.get(c.get("id"))
        if a:
            c = {**c, **{k: v for k, v in a["patch"].items() if c.get(k) is None}}
            c["sources"] = sorted(set(c.get("sources", [])) | set(a["appraisal"].get("sources", [])))
            if a["appraisal"].get("owners") and not c.get("owners"):
                c["owners"] = a["appraisal"]["owners"]
        co = engine.create_company(c)
        if a:
            co["appraisal"] = {**a["appraisal"], "k2": a["k2"], "clamped": a["clamped"], "at": a["at"], "cached": True}
            store.put_company(co)
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
            from app.services.agents import redteam
            redteam.tick(engine)
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
    security_task = asyncio.create_task(security_console.monitor())
    yield
    from app.services.discovery.jobs import service
    await service().close()
    stop.set()
    task.cancel()
    security_task.cancel()


app = FastAPI(title="JB API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

API = "/api/v1"
app.include_router(companies.router, prefix=API)
app.include_router(discovery.router, prefix=API)
app.include_router(market.router, prefix=API)
app.include_router(portfolio.router, prefix=API)
app.include_router(acquire.router, prefix=API)
app.include_router(offers.router, prefix=API)
app.include_router(surveillance.router, prefix=API)
app.include_router(agent.router, prefix=API)
app.include_router(dashboard.router, prefix=API)
app.include_router(security_console.router, prefix=API)
app.include_router(ws.router)  # /ws/markets/{id} at the root, per the contract
app.include_router(graphql_router, prefix="/graphql")


@app.middleware("http")
async def audit_context(request, call_next):
    from app.security import context
    from app.identity import normalize
    parts = request.url.path.strip("/").split("/")
    market_id = next((part for part in parts if part.startswith("co_")), None)
    token = context.set({"actor": normalize(request.headers.get("x-demo-user", "system")).uid,
                         "market_id": market_id, "feature": request.url.path})
    try:
        return await call_next(request)
    finally:
        context.reset(token)


@app.get("/health")
def health():
    return {"ok": True, "companies": len(store.list_companies()), "markets": len(store.list_markets())}


@app.get("/readiness")
def readiness():
    """Which store is live and which keys are set. Useful while keys are still coming in."""
    from app.llm import is_configured

    return {
        "store": STORE_KIND,
        "store_ok": store.ping() if hasattr(store, "ping") else True,
        "llm_xai": is_configured("xai"),
        "llm_ifm": is_configured("ifm"),
        "querit": bool(os.getenv("QUERIT_API_KEY")),
        "google_places": bool(os.getenv("GOOGLE_PLACES_API_KEY")),
        "auth0": False,  # not wired, see docs/DECISIONS.md 011
        "grok_features": ["appraise", "intent", "compliance_review", "narrative", "profile", "suggest_why", "ask_owner", "redteam", "loi", "checklist", "health_report", "chat_agent"],
        "grok": __import__("app.services.agents.grok", fromlist=["status"]).status(),
        "usage": __import__("app.llm", fromlist=["usage_summary"]).usage_summary(),
    }
