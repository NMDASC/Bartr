"""Administrator boundary and contextual, redacted agent audit records."""
from __future__ import annotations
import os
import re
import secrets
import time
import uuid
from contextvars import ContextVar
from fastapi import Header, HTTPException

context: ContextVar[dict] = ContextVar("agent_audit_context", default={})


def require_admin(x_admin_token: str | None = Header(default=None)) -> str:
    expected = os.getenv("ADMIN_API_TOKEN", "")
    if not expected:
        raise HTTPException(503, "Administrator access is not configured. Set ADMIN_API_TOKEN on the API.")
    if not x_admin_token or not secrets.compare_digest(x_admin_token, expected):
        raise HTTPException(403, "An administrator access token is required.")
    return "administrator"


def redact(value):
    if isinstance(value, dict):
        return {k: "[redacted]" if re.search(r"password|secret|token|api.?key|authorization", k, re.I) else redact(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact(v) for v in value]
    if isinstance(value, str):
        for name, secret in os.environ.items():
            if re.search(r"SECRET|TOKEN|API_KEY|MONGODB_URI", name) and len(secret) >= 8:
                value = value.replace(secret, "[redacted]")
        return re.sub(r"(?i)bearer\s+[A-Za-z0-9._~+/-]+=*", "Bearer [redacted]", value)
    return value


def record_call(*, provider, model, messages, output=None, error=None, started=None, feature=None):
    from app.deps import store
    ctx = context.get()
    event = {"id": f"call_{uuid.uuid4().hex[:16]}", "t": time.time(), "actor": ctx.get("actor", "system"),
             "action": "agent_call", "market_id": ctx.get("market_id"), "flag_id": ctx.get("flag_id"),
             "payload": {"provider": provider, "model": model, "feature": feature or ctx.get("feature", "agent"),
                         "status": "error" if error else "success", "duration_ms": round((time.time() - (started or time.time())) * 1000),
                         "input": redact(messages), "output": redact(output), "error": redact(error)}}
    store.audit(event)
    if hasattr(store, "save"):
        store.save()
