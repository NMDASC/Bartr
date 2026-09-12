"""Grok structured extraction. Every numeric field needs a source URL or it is dropped later."""
from __future__ import annotations

from app.llm import complete
from .models import ExtractedCompanies, ExtractedCompany

SYSTEM = (
    "You are an analyst filling company profiles from page text. "
    "Cite a source_url for every numeric field and include a short quote that contains the number. "
    "Mark a fact inferred if the page does not state it directly. "
    "Skip businesses that are not in the query's city or category."
)


async def extract_companies(query: str, pages: list[dict]) -> list[ExtractedCompany]:
    if not pages:
        return []
    packed = "\n\n".join(f"URL: {p['url']}\nTITLE: {p.get('title', '')}\n{p.get('content', '')[:6000]}" for p in pages[:6])
    parsed = await complete(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Query: {query}\n\nPages:\n{packed}"},
        ],
        schema=ExtractedCompanies,
    )
    return list(parsed.companies)
