"""Appraiser: Grok researches a business on the open web and gives a value with reasoning and
sources; K2 gives an independent number. Both feed the valuation ensemble's `llm` estimator
(valuation.py), so the model opinion in the posterior is live instead of hand typed."""
from __future__ import annotations

import math
from pydantic import BaseModel, Field

from app.services.agents import grok
from app.services.discovery import benchmarks as bm

SYSTEM = ("You are a small business appraiser. You are given research notes about one business. "
          "Estimate what it would sell for today as a going concern (asset sale, owner's discretionary earnings basis). "
          "Use the notes; when a number is not in the notes say so in `reasoning` and give a range-informed estimate anyway. "
          "Cite only URLs that appear in the notes.")


class Appraisal(BaseModel):
    value_usd: float = Field(description="most likely sale price today, USD")
    confidence: float = Field(ge=0, le=1, description="0 = pure guess, 1 = audited financials seen")
    revenue_est: float | None = Field(default=None, description="annual revenue if found or inferred")
    sde_est: float | None = Field(default=None, description="seller's discretionary earnings if found or inferred")
    employees_est: int | None = None
    founded_year: int | None = None
    owners: list[str] = Field(default_factory=list)
    reasoning: str = Field(description="three sentences max")
    sources: list[str] = Field(default_factory=list, description="URLs from the notes")


class Opinion(BaseModel):
    value_usd: float
    confidence: float = Field(ge=0, le=1)
    reasoning: str


def _question(c: dict) -> str:
    where = ", ".join(x for x in (c.get("address"), c.get("city"), c.get("state")) if x)
    return (f"Research the small business '{c['name']}' ({c['category'].replace('_', ' ')}) at {where}. "
            f"Find: who owns it, how long it has operated, any revenue, cash flow or asking price figures (BizBuySell, LoopNet, BizQuest, news, "
            f"the business's own site, Yelp or Google reviews), employee count, and anything a buyer would care about. "
            f"Report facts with the URL each came from. Description on file: {c.get('description') or 'none'}.")


async def appraise(c: dict) -> dict | None:
    """Returns an observables patch {llm_estimate, llm_confidence, llm2_estimate?, ...} plus the appraisal, or None."""
    if not grok.configured("xai"):
        return None
    notes = await grok.researched("appraise.research", _question(c),
                                  allowed_domains=None)
    if not notes:
        notes = f"No web research available. Description on file: {c.get('description') or 'none'}. Observables: {c['observables']}"
    user = f"Business: {c['name']}, {c['category']}, {c.get('city')}, {c.get('state')}.\n\nResearch notes:\n{notes[:12000]}"
    a = await grok.structured("appraise", Appraisal, SYSTEM, user, tier="deep")
    if a is None:
        return None
    # clamp to a sane band around the category base rate so one hallucinated zero cannot poison the posterior
    _, med_ask, _, _, _ = bm.get(c["category"])
    base = med_ask * bm.ASK_TO_SOLD * bm.state_index(c.get("state"))
    value = min(max(a.value_usd, 0.2 * base), 5 * base)
    patch = {"llm_estimate": value, "llm_confidence": a.confidence}
    if a.revenue_est and not c["observables"].get("revenue"):
        patch["revenue"] = a.revenue_est
    if a.sde_est and not c["observables"].get("sde"):
        patch["sde"] = a.sde_est
    if a.employees_est and not c["observables"].get("employees"):
        patch["employees"] = a.employees_est
    k2 = await grok.second_opinion("appraise", Opinion, SYSTEM, user)
    if k2 is not None:
        patch["llm2_estimate"] = min(max(k2.value_usd, 0.2 * base), 5 * base)
    return {"patch": patch, "appraisal": a.model_dump(), "k2": k2.model_dump() if k2 else None,
            "notes_excerpt": notes[:1500], "clamped": value != a.value_usd}
