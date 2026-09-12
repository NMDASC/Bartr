"""Portfolio agent: free text -> RiskProfile (Grok structured), and a one sentence reason per
Kelly suggestion written for the user's stated goals. Numbers stay deterministic (kelly.py)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.services.agents import grok
from app.services.agents.intent import CATEGORIES

PROFILE_SYSTEM = ("Turn a person's description of themselves and what they want into an investor profile for buying fractional "
                  "stakes in small businesses. tolerance is 0 (very cautious) to 1 (aggressive). horizon is short, medium or long. "
                  "sectors are drawn from: " + ", ".join(c for c in CATEGORIES if c != "default") +
                  ". states are 2 letter codes; map Pittsburgh, CMU, Pitt, Oakland to PA. budget is USD they can deploy; if unstated use 20000.")

WHY_SYSTEM = ("You explain portfolio suggestions to a buyer in one sentence each, in their own terms. You are given the buyer's profile and "
              "a list of businesses with model value, market price, edge and half Kelly size. Do not restate the numbers; say why this business "
              "fits this person and what the edge means. Plain language, no markdown.")


class RiskProfile(BaseModel):
    tolerance: float = Field(ge=0, le=1)
    horizon: str = "medium"
    sectors: list[str] = Field(default_factory=list)
    states: list[str] = Field(default_factory=list)
    budget: float = 20000
    summary: str = Field(description="one line restating the goal")


class Whys(BaseModel):
    reasons: list[str] = Field(description="one per business, same order")


async def parse_profile(text: str) -> dict | None:
    out = await grok.structured("profile", RiskProfile, PROFILE_SYSTEM, text)
    if out is None:
        return None
    d = out.model_dump()
    d["sectors"] = [s for s in d["sectors"] if s in CATEGORIES]
    d["states"] = [s.upper()[:2] for s in d["states"]]
    d["horizon"] = d["horizon"] if d["horizon"] in ("short", "medium", "long") else "medium"
    return d


async def explain(profile: dict | None, suggestions: list[dict]) -> list[str] | None:
    if not suggestions:
        return []
    rows = [{"name": s["company"]["name"], "category": s["company"]["category"], "city": s["company"]["city"], "price": s["price"],
             "model_value": s["model_value"], "edge": s["edge"], "sigma": s["sigma"], "kelly_fraction": s["kelly_fraction"], "usd": s["suggested_usd"]}
            for s in suggestions[:8]]
    out = await grok.structured("why", Whys, WHY_SYSTEM, f"Profile: {profile or 'unknown, assume a first time buyer'}\nSuggestions: {rows}")
    if out is None or len(out.reasons) < len(rows):
        return None
    return out.reasons[:len(rows)]
