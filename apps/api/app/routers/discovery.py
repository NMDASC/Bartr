"""Discovery: POST /discovery/search -> 202 {job_id, intent}; GET /discovery/jobs/{id} streams SSE.

Seeds stream first (ranked). Set DISCOVERY_LIVE=1 with Querit and xAI keys to append
Places + Querit + Grok extractions after the cached results.
"""
from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.deps import engine, store
from app.schemas import SearchIn, SearchJobAccepted
from app.services.discovery.intent import parse_intent
from app.services.discovery.pipeline import live_enabled, live_events
from app.services.discovery.ranking import rank_companies

router = APIRouter(prefix="/discovery", tags=["discovery"])
JOBS: dict[str, dict] = {}


@router.post("/search", response_model=SearchJobAccepted, status_code=202)
def search(body: SearchIn):
    intent = parse_intent(body.q)
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    JOBS[job_id] = {"q": body.q, "intent": intent}
    return {"job_id": job_id, "intent": intent}


async def run_job(job: dict):
    intent = job["intent"]
    yield {"type": "intent", "intent": intent}
    ranked = rank_companies(job["q"], intent, store.list_companies())
    if not ranked and intent.get("category") != "default":
        loose = {**intent, "city": None, "min_value": None, "max_value": None}
        ranked = rank_companies(job["q"], loose, store.list_companies())
    cards = [{**engine.card(c), "relevance": rank} for c, rank in ranked]
    if cards:
        yield {"type": "ranking", "revision": 1, "companies": cards}
    for c, _rank in ranked:
        yield {"type": "company_stub", "company": engine.card(c)}
        await asyncio.sleep(0.25)
        yield {"type": "company_ready", "company": engine.card(c)}
    extra = 0
    if live_enabled():
        async for ev in live_events(job["q"], intent):
            extra += 1 if ev.get("type") == "company_ready" else 0
            yield ev
    yield {"type": "done", "total": len(ranked) + extra}


@router.get("/jobs/{job_id}")
async def job_stream(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "no such job")

    async def gen():
        async for ev in run_job(job):
            yield f"data: {json.dumps(ev, default=float)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
