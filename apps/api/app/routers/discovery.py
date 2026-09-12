"""Discovery routes. Owner: Zhiyuan. STUBS: replace the bodies, keep the signatures.

The SSE stub emits the real DiscoveryEvent frames from the contract (decision
005) off the seeded companies, so the streaming result list in /search can be
built and demoed before the pipeline exists.
"""

import asyncio
import json
import uuid
from typing import AsyncIterator

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from app.deps import engine, store
from app.schemas import SearchIntent, SearchJobAccepted

router = APIRouter(prefix="/discovery", tags=["discovery"])


def _stub_intent(q: str) -> SearchIntent:
    """Keyword shaped guess. TODO(Zhiyuan): replace with the Grok intent parser."""
    ql = q.lower()
    state = next((s for s in ("OK", "TX", "PA", "OH") if s.lower() in ql), None)
    category = next(
        (c for c in ("laundromat", "car wash", "restaurant", "auto repair") if c in ql),
        "laundromat",
    )
    return SearchIntent(category=category, state=state)


@router.post("/search", response_model=SearchJobAccepted, status_code=202)
def start_search(body: dict):
    # TODO(Zhiyuan): Grok intent parse, Places text search, stub upsert, then a real job.
    q = (body or {}).get("q", "")
    return SearchJobAccepted(job_id=f"job_{uuid.uuid4().hex[:12]}", intent=_stub_intent(q))


@router.get("/jobs/{job_id}")
async def job_stream(job_id: str) -> EventSourceResponse:
    async def events() -> AsyncIterator[dict]:
        # TODO(Zhiyuan): drive this off the pipeline's queue instead of the seeds.
        yield {"data": json.dumps({"type": "intent", "intent": _stub_intent("").model_dump()})}
        companies = store.list_companies()
        for c in companies:
            await asyncio.sleep(0.4)
            yield {"data": json.dumps({"type": "company_ready", "company": engine.card(c)})}
        yield {"data": json.dumps({"type": "done", "total": len(companies)})}

    return EventSourceResponse(events())
