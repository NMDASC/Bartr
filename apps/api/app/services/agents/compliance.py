"""Grok and K2 review the same flag packet independently (Plan.md 9.4)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.llm import LLMNotConfigured, complete, is_configured
from app.security import context

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
        from app.deps import store
        import json
        rules = next((r for r in flag.get("reviews", []) if r["reviewer"] == "rules"), {})
        independent_flag = {k: v for k, v in flag.items() if k not in ("reviews", "reviewer", "disputed")}
        independent_flag.update(severity=rules.get("severity", flag["severity"]), explanation=rules.get("explanation", flag["explanation"]))
        packet = {"flag": independent_flag, "trades": store.trades(flag["market_id"], 40)}
        token = context.set({**context.get(), "feature": "compliance_review", "market_id": flag["market_id"], "flag_id": flag["id"]})
        import asyncio
        return await asyncio.wait_for(complete(
            [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": json.dumps(packet, default=str)},
            ],
            provider=provider,  # type: ignore[arg-type]
            schema=ReviewOpinion,
        ), timeout=40)
    except (LLMNotConfigured, Exception):
        return None
    finally:
        if "token" in locals():
            context.reset(token)


def _norm(sev: str, fallback: str) -> str:
    return sev if sev in SEVERITIES else fallback


async def review_flags(flags: list[dict]) -> list[dict]:
    import asyncio
    out = []
    for flag in flags:
        cache_key = f"{flag['id']}:{flag['t']}"
        cached = _CACHE.get(cache_key)
        expected = {name for provider, name in (("xai", "grok"), ("ifm", "k2")) if is_configured(provider)}
        if cached and expected.issubset({r["reviewer"] for r in cached["reviews"]}):
            out.append(cached)
            continue
        base = cached or flag
        reviews = list(base.get("reviews") or [{"reviewer": "rules", "severity": flag["severity"]}])
        reviews = [{**r, "explanation": r.get("explanation", flag["explanation"])} if r["reviewer"] == "rules" else r for r in reviews]
        existing = {r["reviewer"] for r in reviews}
        async def missing(provider, name):
            return None if name in existing else await _ask(provider, {**base, "reviews": reviews})
        grok, k2 = await asyncio.gather(missing("xai", "grok"), missing("ifm", "k2"))
        explanation = flag["explanation"]
        reviewer = base.get("reviewer", "rules")
        if grok:
            reviews.append({"reviewer": "grok", "severity": _norm(grok.severity, flag["severity"]), "explanation": grok.explanation})
            explanation = grok.explanation.strip() or explanation
            reviewer = "grok"
        if k2:
            reviews.append({"reviewer": "k2", "severity": _norm(k2.severity, flag["severity"]), "explanation": k2.explanation})
            if not grok:
                explanation = k2.explanation.strip() or explanation
                reviewer = "k2"
        grok_sev = next((r["severity"] for r in reviews if r["reviewer"] == "grok"), None)
        k2_sev = next((r["severity"] for r in reviews if r["reviewer"] == "k2"), None)
        disputed = bool(grok_sev and k2_sev and grok_sev != k2_sev)
        severity = grok_sev or k2_sev or flag["severity"]
        primary = next((r for r in reviews if r["reviewer"] == "grok"), None) or next((r for r in reviews if r["reviewer"] == "k2"), None)
        if primary:
            explanation = primary.get("explanation") or explanation
            reviewer = primary["reviewer"]
        updated = {**flag, "reviews": reviews, "explanation": explanation, "reviewer": reviewer,
                   "disputed": disputed, "severity": severity}
        if grok or k2:
            _CACHE[cache_key] = updated
            if len(_CACHE) > 2000:
                del _CACHE[next(iter(_CACHE))]
        out.append(updated)
    return out
