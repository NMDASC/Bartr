"""Search intent with Grok structured output. discovery.py uses it when configured and falls
back to its keyword parser otherwise; both produce the same SearchIntent shape."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.services.agents import grok

CATEGORIES = ["laundromat", "car_wash", "machine_shop", "hvac", "restaurant", "auto_repair", "manufacturing", "landscaping",
              "daycare", "liquor_store", "convenience_store", "self_storage", "trucking", "retail", "funeral_home",
              "assisted_living", "property_mgmt", "default"]

SYSTEM = ("Parse a buyer's request for a small business into a search intent. category must be one of: "
          + ", ".join(CATEGORIES) + ". state is a 2 letter US code or null. city is a proper city name or null "
          "(neighborhoods like Squirrel Hill, Oakland, Bloomfield, Lawrenceville, South Side, Strip District map to Pittsburgh). "
          "min_value and max_value are USD or null. must_have lists concrete requirements the buyer stated.")


class Intent(BaseModel):
    category: str = "default"
    naics_guess: str | None = None
    state: str | None = None
    city: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    must_have: list[str] = Field(default_factory=list)


async def parse(q: str) -> dict | None:
    out = await grok.structured("intent", Intent, SYSTEM, q)
    if out is None:
        return None
    d = out.model_dump()
    if d["category"] not in CATEGORIES:
        d["category"] = "default"
    if d["state"]:
        d["state"] = d["state"].upper()[:2]
    return d
