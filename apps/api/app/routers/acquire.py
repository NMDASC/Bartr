"""Acquisition routes. Owner: Zhiyuan. STUBS -- replace bodies, keep signatures."""

import asyncio
import uuid
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..examples import example
from ..identity import get_current_user
from ..schemas import AcquisitionStart, ChatRequest

router = APIRouter(prefix="/acquire", tags=["acquire"])


@router.post("/{company_id}/start", response_model=AcquisitionStart)
async def start(
    company_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    # TODO(Zhiyuan): one Grok call for the LOI, one for the state-specific checklist.
    return {**example("acquisition"), "acquisition_id": f"acq_{uuid.uuid4().hex[:12]}"}


@router.post("/{acquisition_id}/chat")
async def chat(
    acquisition_id: str,
    body: ChatRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> StreamingResponse:
    async def tokens() -> AsyncIterator[str]:
        # TODO(Zhiyuan): stream from llm.complete and edit loi_md in place.
        for word in f"Stub reply for {acquisition_id}: {body.message}".split():
            await asyncio.sleep(0.03)
            yield word + " "

    return StreamingResponse(tokens(), media_type="text/plain")
