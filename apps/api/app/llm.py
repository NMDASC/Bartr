"""Single entry point for every model call. Owner: Vir.

Both providers are OpenAI compatible (Plan.md section 1.2), so this is one
client with a swapped base_url. Nothing else in the codebase imports `openai`.

    from .llm import complete
    await complete([{"role": "user", "content": "..."}], schema=CompanyProfile)
"""

import logging
from typing import Any, Literal, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel

from .config import get_settings

log = logging.getLogger(__name__)

Provider = Literal["xai", "ifm"]
M = TypeVar("M", bound=BaseModel)

_clients: dict[str, AsyncOpenAI] = {}


class LLMNotConfigured(RuntimeError):
    pass


def client(provider: Provider = "xai") -> AsyncOpenAI:
    if provider in _clients:
        return _clients[provider]
    s = get_settings()
    if provider == "xai":
        if not s.xai_api_key:
            raise LLMNotConfigured("XAI_API_KEY is unset")
        c = AsyncOpenAI(api_key=s.xai_api_key, base_url=s.xai_base_url)
    elif provider == "ifm":
        if not (s.ifm_api_key and s.ifm_base_url):
            raise LLMNotConfigured("IFM_API_KEY / IFM_BASE_URL are unset")
        c = AsyncOpenAI(api_key=s.ifm_api_key, base_url=s.ifm_base_url)
    else:
        raise ValueError(f"unknown provider {provider!r}")
    _clients[provider] = c
    return c


def default_model(provider: Provider) -> str:
    s = get_settings()
    return s.xai_model if provider == "xai" else s.ifm_model


def is_configured(provider: Provider) -> bool:
    try:
        client(provider)
        return True
    except LLMNotConfigured:
        return False


async def complete(
    messages: list[dict[str, Any]],
    *,
    provider: Provider = "xai",
    model: str | None = None,
    schema: type[M] | None = None,
    tools: list[dict[str, Any]] | None = None,
    temperature: float = 0.2,
) -> str | M:
    """Chat completion. With `schema`, returns a parsed model instance."""
    c = client(provider)
    kwargs: dict[str, Any] = {
        "model": model or default_model(provider),
        "messages": messages,
        "temperature": temperature,
    }
    if tools:
        kwargs["tools"] = tools

    if schema is not None:
        parsed = await c.beta.chat.completions.parse(response_format=schema, **kwargs)
        out = parsed.choices[0].message.parsed
        if out is None:
            raise RuntimeError("model returned no parsed content")
        return out

    resp = await c.chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""
