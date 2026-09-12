"""Google Places Text Search (New). Returns [] when the key is missing."""
from __future__ import annotations

import os

import httpx


async def text_search(query: str, count: int = 8) -> list[dict]:
    key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not key:
        return []
    body = {"textQuery": query, "pageSize": min(count, 20)}
    headers = {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.location",
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
        out.append({
            "name": name,
            "source_url": p.get("googleMapsUri") or p.get("websiteUri") or "https://maps.google.com/",
            "address": p.get("formattedAddress"),
            "website": p.get("websiteUri"),
            "phone": p.get("nationalPhoneNumber"),
            "rating": p.get("rating"),
            "review_count": p.get("userRatingCount"),
            "lat": loc.get("latitude"),
            "lng": loc.get("longitude"),
        })
    return out
