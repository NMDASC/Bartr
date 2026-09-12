"""Discovery routes. Owner: Zhiyuan. STUBS -- replace bodies, keep signatures.

The SSE stub emits real `company_ready` events off the contract examples so the
streaming result list in /search can be built before the pipeline exists.
"""

import asyncio
import json
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, status
from sse_starlette.sse import EventSourceResponse

from ..examples import example
from ..schemas import SearchAccepted, SearchRequest

router = APIRouter(prefix="/discovery", tags=["discovery"])


@router.post("/search", response_model=SearchAccepted, status_code=status.HTTP_202_ACCEPTED)
async def start_search(body: SearchRequest) -> SearchAccepted:
    # TODO(Zhiyuan): Grok intent parse -> Places text search -> stub upsert -> job.
    intent = example("intent")
    return SearchAccepted(job_id=f"job_{uuid.uuid4().hex[:12]}", intent=intent)


@router.get("/jobs/{job_id}")
async def job_stream(job_id: str) -> EventSourceResponse:
    async def events() -> AsyncIterator[dict]:
        # TODO(Zhiyuan): drive this off the real pipeline's queue.
        for company in example("companies"):
            await asyncio.sleep(0.4)
            yield {"event": "company_ready", "data": json.dumps({"company": company})}
        yield {"event": "done", "data": json.dumps({"job_id": job_id})}

    return EventSourceResponse(events())
