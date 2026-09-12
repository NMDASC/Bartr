"""Grok and K2 review the same flag packet independently (Plan.md 9.4)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.llm import LLMNotConfigured, complete, is_configured

_CACHE: dict[str, dict] = {}
SEVERITIES = ("benign", "low", "medium", "high")


class ReviewOpinion(BaseModel):
    severity: str = Field(pattern="^(benign|low|medium|high)$")
    explanation: str


SYSTEM = (
    "You are a market surveillance officer. Review one flag from a 10 second batch auction. "
    "You may downgrade to benign if the tape looks like ordinary flow. "
    "Keep the explanation to two short sentences."
)


async def _ask(provider: str, flag: dict) -> ReviewOpinion | None:
    if not is_configured(provider):  # type: ignore[arg-type]
        return None
    try:
        return await complete(
            [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": (
                    f"rule={flag['rule']} severity={flag['severity']} subjects={flag['subjects']}\n"
                    f"{flag['explanation']}"
                )},
            ],
            provider=provider,  # type: ignore[arg-type]
            schema=ReviewOpinion,
        )
    except (LLMNotConfigured, Exception):
        return None


def _norm(sev: str, fallback: str) -> str:
    return sev if sev in SEVERITIES else fallback


async def review_flags(flags: list[dict]) -> list[dict]:
    out = []
    for flag in flags:
        cached = _CACHE.get(flag["id"])
        if cached:
            out.append(cached)
            continue
        reviews = list(flag.get("reviews") or [{"reviewer": "rules", "severity": flag["severity"]}])
        grok = await _ask("xai", flag)
        k2 = await _ask("ifm", flag)
        explanation = flag["explanation"]
        reviewer = "rules"
        if grok:
            reviews.append({"reviewer": "grok", "severity": _norm(grok.severity, flag["severity"])})
            explanation = grok.explanation.strip() or explanation
            reviewer = "grok"
        if k2:
            reviews.append({"reviewer": "k2", "severity": _norm(k2.severity, flag["severity"])})
            if not grok:
                explanation = k2.explanation.strip() or explanation
                reviewer = "k2"
        grok_sev = next((r["severity"] for r in reviews if r["reviewer"] == "grok"), None)
        k2_sev = next((r["severity"] for r in reviews if r["reviewer"] == "k2"), None)
        disputed = bool(grok_sev and k2_sev and grok_sev != k2_sev)
        severity = grok_sev or k2_sev or flag["severity"]
        updated = {**flag, "reviews": reviews, "explanation": explanation, "reviewer": reviewer,
                   "disputed": disputed, "severity": severity}
        _CACHE[flag["id"]] = updated
        out.append(updated)
    return out
