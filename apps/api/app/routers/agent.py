"""Chat agent. Owner: Zhiyuan. STUB -- replace body, keep the signature.

Transport agnostic on purpose: the future iMessage bridge posts here with
`session_id` set to a phone number (Plan.md section 9.5).
"""

import asyncio
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..identity import get_current_user
from ..schemas import ChatRequest

router = APIRouter(prefix="/agent", tags=["agent"])

TOOLS = [
    "search_companies",
    "get_company",
    "get_book",
    "place_order",
    "suggest_portfolio",
]


@router.post("/chat")
async def chat(
    body: ChatRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> StreamingResponse:
    async def tokens() -> AsyncIterator[str]:
        # TODO(Zhiyuan): llm.complete with tools=TOOLS, loop on tool calls.
        reply = f"Stub agent reply to: {body.message}. Tools wired: {', '.join(TOOLS)}."
        for word in reply.split():
            await asyncio.sleep(0.03)
            yield word + " "

    return StreamingResponse(tokens(), media_type="text/plain")
