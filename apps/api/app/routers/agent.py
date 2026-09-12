"""Chat agent. Transport agnostic and not streaming (decision 006)."""
from fastapi import APIRouter, Depends

from app.deps import current_user, engine, store
from app.schemas import AgentChatRequest, AgentMessage
from app.services.agents.chat_agent import reply

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat", response_model=AgentMessage)
async def chat(body: AgentChatRequest, uid: str = Depends(current_user)):
    return await reply(body.message, uid, engine, store)
