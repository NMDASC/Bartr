"""Bounded Querit search/content adapter; normalizes the documented nested response."""
from __future__ import annotations

import asyncio
import ipaddress
import os
import time
from urllib.parse import urlsplit, urlunsplit

import httpx


def public_url(raw: str) -> str | None:
    try:
        parts = urlsplit(raw)
        host = (parts.hostname or "").lower().rstrip(".")
        if parts.scheme not in ("http", "https") or not host or parts.username or parts.password:
            return None
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal")) or "." not in host:
            return None
        try:
            if not ipaddress.ip_address(host).is_global:
                return None
        except ValueError:
            pass
        return urlunsplit((parts.scheme, parts.netloc.lower(), parts.path or "/", parts.query, ""))
    except ValueError:
        return None


class Querit:
    def __init__(self, client: httpx.AsyncClient | None = None):
        self.client = client
        self.lock = asyncio.Lock()
        self.last_request = 0.
        self.cache: dict[tuple, tuple[float, dict]] = {}

    async def request(self, endpoint: str, body: dict) -> dict:
        key = os.getenv("QUERIT_API_KEY", "")
        if not key:
            raise RuntimeError("Querit is not configured")
        async with self.lock:
            for attempt in range(3):
                interval = max(.1, float(os.getenv("QUERIT_INTERVAL_SECONDS", "1")))
                await asyncio.sleep(max(0., interval - (time.monotonic() - self.last_request)))
                self.last_request = time.monotonic()
                try:
                    async def send(client):
                        return await client.post("https://api.querit.ai/v1/" + endpoint,
                                                 headers={"Authorization": f"Bearer {key}"}, json=body, timeout=20.)
                    if self.client:
                        response = await send(self.client)
                    else:
                        async with httpx.AsyncClient() as client:
                            response = await send(client)
                    if response.status_code == 429 or response.status_code >= 500:
                        if attempt < 2:
                            await asyncio.sleep(2**attempt)
                            continue
                    response.raise_for_status()
                    data = response.json()
                    if data.get("error_code", 200) not in (0, 200):
                        raise RuntimeError("Querit rejected the request")
                    return data
                except (httpx.TimeoutException, httpx.NetworkError):
                    if attempt == 2:
                        raise
        raise RuntimeError("Querit retry budget exhausted")

    async def search(self, query: str, count: int = 10) -> list[dict]:
        cache_key = (query.casefold().strip(), count)
        cached = self.cache.get(cache_key)
        if cached and time.monotonic() - cached[0] < 900:
            return cached[1]["pages"]
        data = await self.request("search", {"query": query, "count": count, "needContent": True,
                                             "filters": {"languages": {"include": ["english"]}}})
        raw = data.get("results", {})
        results = raw.get("result", []) if isinstance(raw, dict) else raw
        pages, seen = [], set()
        for item in results[:count]:
            url = public_url(item.get("url", ""))
            if not url or url in seen:
                continue
            seen.add(url)
            content = "\n".join(item.get("sentence") or []) or item.get("snippet", "")
            pages.append({"url": url, "title": item.get("title", ""), "content": content[:12000]})
        if len(self.cache) >= 128:
            self.cache.pop(next(iter(self.cache)))
        self.cache[cache_key] = (time.monotonic(), {"pages": pages})
        return pages

    async def contents(self, pages: list[dict]) -> list[dict]:
        if not pages:
            return []
        data = await self.request("contents", {"urls": [p["url"] for p in pages[:6]], "format": "text", "extrasMeta": True})
        by_url = {public_url(p.get("url", "")): p for p in data.get("results", [])}
        return [{**p, "content": (by_url.get(p["url"], {}).get("content") or p["content"])[:12000]} for p in pages]
