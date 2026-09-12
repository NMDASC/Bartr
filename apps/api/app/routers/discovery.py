"""Discovery: POST /discovery/search -> 202 {job_id, intent}; GET /discovery/jobs/{id} streams SSE.

Jobs rank seeds first. Set DISCOVERY_LIVE=1 with Querit and xAI keys to append
Places + Querit + Grok extractions after the cached results.
"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas import SearchJobAccepted
from app.services.discovery.jobs import service
from app.services.discovery.models import DiscoveryRequest

router = APIRouter(prefix="/discovery", tags=["discovery"])


@router.post("/search", response_model=SearchJobAccepted, status_code=202)
async def search(body: DiscoveryRequest):
    from app.services.agents import intent as intent_agent
    try:
        if not body.q.strip():
            raise ValueError("Enter a search query")
        try:
            intent = await asyncio.wait_for(intent_agent.parse(body.q), timeout=10)
        except TimeoutError:
            intent = None
        job = service().start(body, intent=intent)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"job_id": job.id, "intent": job.intent}


@router.get("/jobs/{job_id}")
async def job_stream(job_id: str, last_event_id: str | None = Header(default=None)):
    jobs = service()
    try:
        job = jobs.get(job_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    try:
        after = int(last_event_id or 0)
        if after < 0:
            raise ValueError()
    except ValueError as exc:
        raise HTTPException(400, "Invalid event cursor") from exc

    async def gen():
        async for event_id, ev in jobs.events(job, after):
            if ev is None:
                yield ": keep-alive\n\n"
            else:
                yield f"id: {event_id}\ndata: {json.dumps(ev, default=float)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
