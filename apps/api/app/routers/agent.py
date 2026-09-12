"""Shared web/iMessage conversation, isolated by the normalized caller identity."""
import os
import secrets
import time
import uuid
import asyncio
from fastapi import APIRouter, Depends, Header, HTTPException
from app import views
from app.deps import current_user, engine, store
from app.schemas import AgentChatRequest, AgentMessage
from app.services.agents.chat_agent import reply
from app.security import redact

router = APIRouter(prefix="/agent", tags=["agent"])
_requests: dict[tuple[str, str], asyncio.Lock] = {}


def bridge_auth(token):
    expected = os.getenv("BRIDGE_API_TOKEN", "")
    if not expected or not token or not secrets.compare_digest(token, expected):
        raise HTTPException(403, "Bridge authentication failed")


@router.post("/chat", response_model=AgentMessage)
async def chat(body: AgentChatRequest, uid: str = Depends(current_user), x_bridge_token: str | None = Header(default=None)):
    if x_bridge_token:
        bridge_auth(x_bridge_token)
    if not body.message.strip() or len(body.message) > 8000:
        raise HTTPException(422, "Message must contain 1 to 8,000 characters")
    channel = "imessage" if x_bridge_token else "web"
    key = (uid, body.request_id or uuid.uuid4().hex)
    lock = _requests.setdefault(key, asyncio.Lock())
    try:
        async with lock:
            if body.request_id:
                prior = next((e for e in reversed(store.audit_log(10000)) if e.get("actor") == uid
                              and e.get("action") == "conversation" and e.get("request_id") == body.request_id), None)
                if prior:
                    if prior["payload"]["message"] != redact(body.message):
                        raise HTTPException(409, "This message ID was already used for a different request")
                    return AgentMessage.model_validate(prior["payload"]["reply"])
            output = await reply(body.message, uid, engine, store)
            store.audit({"id": f"msg_{uuid.uuid4().hex[:16]}", "t": time.time(), "actor": uid, "action": "conversation", "request_id": body.request_id,
                         "payload": {"channel": channel, "message": redact(body.message), "reply": redact(output.model_dump())}})
            if hasattr(store, "save"):
                store.save()
            return output
    finally:
        if _requests.get(key) is lock:
            _requests.pop(key, None)


@router.get("/messages")
def messages(uid: str = Depends(current_user)):
    out = []
    for e in store.audit_log(10000):
        if e.get("actor") == uid and e.get("action") == "conversation":
            p = e["payload"]
            out.extend([{"role": "user", "content": p["message"], "channel": p["channel"], "t": views.iso(e["t"])},
                        {**p["reply"], "channel": p["channel"], "t": views.iso(e["t"])}])
    return out[-100:]


@router.get("/channel")
def channel(uid: str = Depends(current_user)):
    recent = [e for e in store.audit_log(10000) if e.get("action") == "bridge_heartbeat"]
    seen = recent[-1]["t"] if recent else None
    number = os.getenv("IMESSAGE_NUMBER", "").strip()
    configured = bool(number and os.getenv("BRIDGE_API_TOKEN"))
    return {"configured": configured, "connected": bool(configured and seen and time.time()-seen < 120),
            "phone_number": number or None, "last_seen": views.iso(seen), "identity": uid,
            "identity_kind": (store.get_user(uid) or {}).get("identity_kind", "name")}


@router.post("/heartbeat")
def heartbeat(x_bridge_token: str | None = Header(default=None)):
    bridge_auth(x_bridge_token)
    store.audit({"id": f"hb_{uuid.uuid4().hex[:12]}", "t": time.time(), "actor": "imessage_bridge", "action": "bridge_heartbeat", "payload": {}})
    return {"ok": True}
