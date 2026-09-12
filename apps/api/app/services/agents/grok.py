"""Thin, failure tolerant wrappers around app/llm.py for every Grok and K2 use in the app.

Rules:
  * Every call can return None. Callers always have a deterministic fallback, so the demo
    never depends on a key or on the network.
  * Structured outputs go through llm.complete(schema=...). Research goes through the
    xAI Responses API with the server side web_search tool, then a second structured pass.
  * Small in-memory cache keyed by (name, prompt hash) so a page refresh does not re-bill.
  * K2 (provider="ifm") is the independent second opinion wherever a judgment is made.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
from typing import Any, TypeVar

from pydantic import BaseModel

from app import llm

M = TypeVar("M", bound=BaseModel)

_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = float(os.getenv("GROK_CACHE_TTL", "600"))
CALLS: list[dict] = []   # last calls, surfaced on /readiness for the demo


def configured(provider: str = "xai") -> bool:
    return llm.is_configured(provider)  # type: ignore[arg-type]


def _key(name: str, *parts: Any) -> str:
    h = hashlib.sha1(json.dumps(parts, default=str, sort_keys=True).encode()).hexdigest()[:16]
    return f"{name}:{h}"


def _remember(name: str, provider: str, ok: bool, ms: float, note: str = "") -> None:
    CALLS.append({"t": time.time(), "name": name, "provider": provider, "ok": ok, "ms": round(ms), "note": note[:120]})
    del CALLS[:-50]


async def structured(name: str, schema: type[M], system: str, user: str, *, provider: str = "xai",
                     temperature: float = 0.2, cache: bool = True) -> M | None:
    """One structured call. None if the provider is not configured or anything fails."""
    if not configured(provider):
        return None
    k = _key(name, provider, schema.__name__, system, user)
    if cache and k in _cache and time.time() - _cache[k][0] < CACHE_TTL:
        return _cache[k][1]
    t0 = time.time()
    try:
        out = await asyncio.wait_for(
            llm.complete([{"role": "system", "content": system}, {"role": "user", "content": user}],
                         provider=provider, schema=schema, temperature=temperature),  # type: ignore[arg-type]
            timeout=float(os.getenv("GROK_TIMEOUT_S", "45")))
        _cache[k] = (time.time(), out)
        _remember(name, provider, True, (time.time() - t0) * 1000)
        return out  # type: ignore[return-value]
    except Exception as e:  # noqa: BLE001
        _remember(name, provider, False, (time.time() - t0) * 1000, repr(e))
        return None


async def text(name: str, system: str, user: str, *, provider: str = "xai", temperature: float = 0.4, cache: bool = True) -> str | None:
    if not configured(provider):
        return None
    k = _key(name, provider, system, user)
    if cache and k in _cache and time.time() - _cache[k][0] < CACHE_TTL:
        return _cache[k][1]
    t0 = time.time()
    try:
        out = await asyncio.wait_for(
            llm.complete([{"role": "system", "content": system}, {"role": "user", "content": user}],
                         provider=provider, temperature=temperature),  # type: ignore[arg-type]
            timeout=float(os.getenv("GROK_TIMEOUT_S", "45")))
        _cache[k] = (time.time(), out)
        _remember(name, provider, True, (time.time() - t0) * 1000)
        return out  # type: ignore[return-value]
    except Exception as e:  # noqa: BLE001
        _remember(name, provider, False, (time.time() - t0) * 1000, repr(e))
        return None


async def researched(name: str, question: str, *, allowed_domains: list[str] | None = None, cache: bool = True) -> str | None:
    """Grok with the server side web_search tool (xAI Responses API). Returns the answer text
    with inline citations, or None. Only xAI supports this tool."""
    if not configured("xai"):
        return None
    k = _key(name, "xai", question, allowed_domains)
    if cache and k in _cache and time.time() - _cache[k][0] < CACHE_TTL:
        return _cache[k][1]
    t0 = time.time()
    try:
        c = llm.client("xai")
        tool: dict[str, Any] = {"type": "web_search"}
        if allowed_domains:
            tool["filters"] = {"allowed_domains": allowed_domains[:5]}
        resp = await asyncio.wait_for(
            c.responses.create(model=llm.default_model("xai"), input=[{"role": "user", "content": question}], tools=[tool]),
            timeout=float(os.getenv("GROK_TIMEOUT_S", "90")))
        out = getattr(resp, "output_text", None) or ""
        if not out:
            # fall back to walking the output items
            for item in getattr(resp, "output", []) or []:
                for part in getattr(item, "content", []) or []:
                    out += getattr(part, "text", "") or ""
        _cache[k] = (time.time(), out or None)
        _remember(name, "xai+web_search", bool(out), (time.time() - t0) * 1000)
        return out or None
    except Exception as e:  # noqa: BLE001
        _remember(name, "xai+web_search", False, (time.time() - t0) * 1000, repr(e))
        return None


async def second_opinion(name: str, schema: type[M], system: str, user: str) -> M | None:
    """Same question to K2 (IFM). None when IFM is not configured."""
    return await structured(name + ":k2", schema, system, user, provider="ifm")


def status() -> dict:
    return {"xai": configured("xai"), "ifm": configured("ifm"), "recent_calls": CALLS[-10:]}
