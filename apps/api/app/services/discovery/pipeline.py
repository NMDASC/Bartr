"""Legacy live-event adapter. DiscoveryJobs is the REST/GraphQL implementation."""
from __future__ import annotations

import os

from app.deps import engine
from app.llm import is_configured

from .extract import extract_companies
from .places import text_search
from .pricing import save_company, verified_company
from .querit import Querit


def live_enabled() -> bool:
    return os.getenv("DISCOVERY_LIVE", "0") == "1" and bool(
        os.getenv("QUERIT_API_KEY") or os.getenv("GOOGLE_PLACES_API_KEY") or is_configured("xai")
    )


async def live_events(query: str, intent: dict):
    """Yield DiscoveryEvent dicts for newly extracted companies. Failures stay local."""
    where = intent.get("city") or intent.get("state") or ""
    category = intent.get("category") if intent.get("category") != "default" else ""
    place_q = " ".join(x for x in (category, "in", where) if x) or query
    places = []
    try:
        places = await text_search(place_q, count=6)
    except Exception as e:
        yield {"type": "company_failed", "company_id": "places", "reason": str(e)[:200]}

    pages = []
    try:
        querit = Querit()
        pages = await querit.search(query, count=8)
        pages = await querit.contents(pages)
    except Exception as e:
        yield {"type": "company_failed", "company_id": "querit", "reason": str(e)[:200]}
        pages = []

    if places:
        extra = "\n".join(
            f"{p['name']}, {p.get('address') or ''}. rating {p.get('rating')} ({p.get('review_count')} reviews). {p.get('website') or ''}"
            for p in places
        )
        pages = [{"url": "https://maps.google.com/places", "title": "Places", "content": extra}, *pages]

    if not pages:
        return
    try:
        extracted = await extract_companies(query, pages)
    except Exception as e:
        yield {"type": "company_failed", "company_id": "extract", "reason": str(e)[:200]}
        return

    seen = {c["id"] for c in engine.store.list_companies()}
    for item in extracted:
        try:
            data = verified_company(item, pages)
            company = save_company(engine, data)
        except (ValueError, TypeError) as e:
            yield {"type": "company_failed", "company_id": item.name, "reason": str(e)[:200]}
            continue
        if company["id"] in seen:
            yield {"type": "company_ready", "company": engine.card(company)}
            continue
        seen.add(company["id"])
        yield {"type": "company_stub", "company": engine.card(company)}
        yield {"type": "company_ready", "company": engine.card(company)}
