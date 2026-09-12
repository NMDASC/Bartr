"""Google Places Text Search (New). Returns [] when the key is missing."""
from __future__ import annotations

import os
import json

import httpx

from .models import Evidence, ExtractedCompany


PLACE_CATEGORIES = {"laundry": "laundromat", "car_wash": "car_wash", "restaurant": "restaurant", "car_repair": "auto_repair"}


def sourced_company(place: dict, fallback_category: str | None = None) -> ExtractedCompany | None:
    """Structured Places facts can be displayed before model enrichment finishes."""
    category = place.get("category") or fallback_category
    if place.get("country") != "US" or not place.get("city") or not place.get("state") or not category:
        return None
    evidence = [Evidence(field=key, value=place[key], source_url=place["source_url"],
                         quote=f'"{key}": {json.dumps(place[key])}')
                for key in ("rating", "review_count") if place.get(key) is not None]
    return ExtractedCompany(name=place["name"], category=category, city=place["city"], state=place["state"],
        address=place.get("address"), website=place.get("website"), phone=place.get("phone"), description=None, evidence=evidence)


async def text_search(query: str, count: int = 8) -> list[dict]:
    key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not key:
        return []
    body = {"textQuery": query, "pageSize": min(count, 20)}
    headers = {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.addressComponents,places.types,places.websiteUri,places.googleMapsUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.location",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post("https://places.googleapis.com/v1/places:searchText", json=body, headers=headers)
        r.raise_for_status()
        places = r.json().get("places") or []
    out = []
    for p in places[:count]:
        loc = p.get("location") or {}
        name = (p.get("displayName") or {}).get("text") or ""
        if not name:
            continue
        components = p.get("addressComponents") or []
        def component(kind, short=False):
            return next((c.get("shortText" if short else "longText") for c in components if kind in c.get("types", [])), None)
        out.append({
            "name": name,
            "source_url": p.get("googleMapsUri") or p.get("websiteUri") or "https://maps.google.com/",
            "address": p.get("formattedAddress"),
            "city": component("locality") or component("postal_town") or component("sublocality_level_1"),
            "state": component("administrative_area_level_1", short=True),
            "country": component("country", short=True),
            "category": next((PLACE_CATEGORIES[t] for t in p.get("types", []) if t in PLACE_CATEGORIES), None),
            "website": p.get("websiteUri"),
            "phone": p.get("nationalPhoneNumber"),
            "rating": p.get("rating"),
            "review_count": p.get("userRatingCount"),
            "lat": loc.get("latitude"),
            "lng": loc.get("longitude"),
        })
    return out
