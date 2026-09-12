"""xAI web-search adapter for business discovery.

Grok's Responses API returns a cited synthesis rather than the search-result rows
Querit returns.  Keep only paragraphs with inline citations and expose those as
the same small page shape the evidence pipeline already understands.
"""
from __future__ import annotations

import re

from app.services.agents import grok

from .querit import public_url


_CITATION = re.compile(r"\[\[\d+\]\]\((https?://[^)]+)\)")


class GrokWebSearch:
    async def search(self, query: str, count: int = 10) -> list[dict]:
        prompt = (
            f"Search the open web for up to {min(count, 12)} identifiable, currently operating "
            f"US businesses matching this request: {query!r}. Use one paragraph per business. "
            "Give the exact business name, city, two-letter state, street address when available, "
            "business category, website, phone, rating and review count. Include revenue, cash flow, "
            "asking price or employee count only when a source publishes it. Cite every business "
            "paragraph inline. Do not return directories, category roundups, or invented facts."
        )
        answer = await grok.researched("discovery:web_search", prompt)
        if not answer:
            return []

        pages: list[dict] = []
        seen: set[str] = set()
        # Grok normally uses one paragraph per requested business. Line fallback
        # handles compact list output without assigning one claim to every source.
        blocks = [block.strip() for block in re.split(r"\n\s*\n", answer) if block.strip()]
        if len(blocks) == 1:
            blocks = [line.strip() for line in answer.splitlines() if line.strip()]
        for block in blocks:
            urls = _CITATION.findall(block)
            content = _CITATION.sub("", block).strip()
            if not content:
                continue
            for raw_url in urls:
                url = public_url(raw_url)
                if not url or url in seen:
                    continue
                seen.add(url)
                pages.append({"url": url, "title": "Grok web search", "content": content, "provider": "grok"})
                if len(pages) >= count:
                    return pages
        return pages
