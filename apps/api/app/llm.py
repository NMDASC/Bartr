"""Single entry point for every model call. Owner: Vir.

Both providers are OpenAI compatible (Plan.md 1.2), so this is one client with
a swapped base_url. Nothing else in the codebase imports `openai`, which is
what lets K2 take any role Grok has by passing provider="ifm".

    from app.llm import complete
    profile = await complete(messages, schema=CompanyProfile)
"""
from __future__ import annotations

import json
import os
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Literal, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel

Provider = Literal["xai", "ifm"]
M = TypeVar("M", bound=BaseModel)

_clients: dict[str, AsyncOpenAI] = {}
_raw_response: ContextVar[Any] = ContextVar("llm_raw_response", default=None)

_CONFIG = {
    "xai": ("XAI_API_KEY", "XAI_BASE_URL", "XAI_MODEL", "https://api.x.ai/v1", "grok-4.6"),
    "ifm": ("IFM_API_KEY", "IFM_BASE_URL", "IFM_MODEL", "", ""),
}


class LLMNotConfigured(RuntimeError):
    pass


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class Completion:
    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)


def default_model(provider: Provider) -> str:
    _, _, model_var, _, model_default = _CONFIG[provider]
    return os.getenv(model_var) or model_default


def fast_model(provider: Provider = "xai") -> str:
    """Model for interactive calls. Measured Sat 03:00: grok-4.20-0309-non-reasoning answers a structured
    parse in 0.8s vs 6.4s for grok-4.6 (and 20 to 45s on bigger prompts, because 4.6 reasons). Keep
    grok-4.6 (default_model) for research with web_search, where quality matters more than latency."""
    if provider == "xai":
        return os.getenv("XAI_FAST_MODEL") or "grok-4.20-0309-non-reasoning"
    return default_model(provider)


def client(provider: Provider = "xai") -> AsyncOpenAI:
    if provider in _clients:
        return _clients[provider]
    if provider not in _CONFIG:
        raise ValueError(f"unknown provider {provider!r}")
    key_var, url_var, _, url_default, _ = _CONFIG[provider]
    key = os.getenv(key_var, "")
    base_url = os.getenv(url_var) or url_default
    if not key or not base_url:
        raise LLMNotConfigured(f"{key_var} and {url_var} must be set")
    _clients[provider] = AsyncOpenAI(api_key=key, base_url=base_url)
    return _clients[provider]


def is_configured(provider: Provider) -> bool:
    try:
        client(provider)
        return True
    except (LLMNotConfigured, ValueError):
        return False


async def _complete(
    messages: list[dict[str, Any]],
    *,
    provider: Provider = "xai",
    model: str | None = None,
    schema: type[M] | None = None,
    tools: list[dict[str, Any]] | None = None,
    web_search: bool = False,
    allowed_domains: list[str] | None = None,
    temperature: float = 0.2,
    reasoning_effort: Literal["low", "medium", "high", "xhigh"] | None = None,
) -> str | M | Completion:
    """Chat completion. With `schema`, returns a parsed model instance.
    With `tools`, returns Completion so the caller can run a tool loop."""
    c = client(provider)
    kwargs: dict[str, Any] = {
        "model": model or default_model(provider),
        "messages": messages,
        "temperature": temperature,
    }
    if reasoning_effort is not None:
        kwargs["reasoning_effort"] = reasoning_effort
    call_tools = list(tools or [])
    if web_search:
        search: dict[str, Any] = {"type": "web_search"}
        if allowed_domains:
            search["filters"] = {"allowed_domains": allowed_domains[:5]}
        call_tools.append(search)
    if call_tools:
        kwargs["tools"] = call_tools

    if schema is not None:
        parsed = await c.beta.chat.completions.parse(response_format=schema, **kwargs)
        from app.security import response_snapshot
        _raw_response.set(response_snapshot(parsed))
        out = parsed.choices[0].message.parsed
        if out is None:
            raise RuntimeError("model returned no parsed content")
        return out

    resp = await c.chat.completions.create(**kwargs)
    from app.security import response_snapshot
    _raw_response.set(response_snapshot(resp))
    msg = resp.choices[0].message
    if tools:
        calls = []
        for tc in msg.tool_calls or []:
            fn = tc.function
            try:
                args = json.loads(fn.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            calls.append(ToolCall(id=tc.id, name=fn.name, arguments=args if isinstance(args, dict) else {}))
        return Completion(content=msg.content or "", tool_calls=calls)
    return msg.content or ""


async def complete(messages, **kwargs):
    """Audited entry point, including structured output and every tool-loop turn."""
    import time
    import asyncio
    from dataclasses import asdict, is_dataclass
    from app.security import error_response, record_call
    started = time.time()
    feature = kwargs.pop("audit_feature", None)
    provider = kwargs.get("provider", "xai")
    model = kwargs.get("model") or default_model(provider)
    raw_token = _raw_response.set(None)
    try:
        try:
            out = await _complete(messages, **kwargs)
            result = out.model_dump() if isinstance(out, BaseModel) else asdict(out) if is_dataclass(out) else out
        except (Exception, asyncio.CancelledError) as exc:
            raw = _raw_response.get()
            record_call(provider=provider, model=model, messages=messages, error=f"{type(exc).__name__}: {exc}",
                        started=started, feature=feature, raw_response=raw if raw is not None else error_response(exc))
            raise
        record_call(provider=provider, model=model, messages=messages, output=result, started=started,
                    feature=feature, raw_response=_raw_response.get())
        return out
    finally:
        _raw_response.reset(raw_token)
