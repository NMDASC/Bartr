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
from dataclasses import dataclass, field
from typing import Any, Literal, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel

Provider = Literal["xai", "ifm"]
M = TypeVar("M", bound=BaseModel)

_clients: dict[str, AsyncOpenAI] = {}

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


async def complete(
    messages: list[dict[str, Any]],
    *,
    provider: Provider = "xai",
    model: str | None = None,
    schema: type[M] | None = None,
    tools: list[dict[str, Any]] | None = None,
    web_search: bool = False,
    allowed_domains: list[str] | None = None,
    temperature: float = 0.2,
) -> str | M | Completion:
    """Chat completion. With `schema`, returns a parsed model instance.
    With `tools`, returns Completion so the caller can run a tool loop."""
    c = client(provider)
    kwargs: dict[str, Any] = {
        "model": model or default_model(provider),
        "messages": messages,
        "temperature": temperature,
    }
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
        out = parsed.choices[0].message.parsed
        if out is None:
            raise RuntimeError("model returned no parsed content")
        return out

    resp = await c.chat.completions.create(**kwargs)
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
