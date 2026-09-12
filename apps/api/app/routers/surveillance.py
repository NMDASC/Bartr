"""Surveillance: audit log, owner treasury summary, and rule based flags (Plan.md 9.4, rules layer).
Role D adds the Grok and K2 reviewers on top: each flag's `reviews[]` gets their severities and
`disputed` flips when they disagree."""
import time
import uuid

from fastapi import APIRouter

from app import views
from app.deps import store
from app.schemas import Flag

router = APIRouter(prefix="/surveillance", tags=["surveillance"])


@router.get("/audit")
def audit(limit: int = 200, actor: str | None = None):
    log = store.audit_log(limit * 5 if actor else limit)
    if actor:
        log = [e for e in log if e.get("actor") == actor][-limit:]
    return [{**e, "t": views.iso(e["t"])} for e in log]


@router.get("/treasury")
def treasury_summary():
    out = []
    for m in store.list_markets():
        c = store.get_company(m["id"])
        t = m["treasury"]
        out.append({"market_id": m["id"], "name": c["name"], "proceeds": t["proceeds"], "unsold_float": t["unsold_float"],
                    "bought_back": t["bought_back"], "floor_price": t["floor_price"], "fees_collected": m["fees_collected"]})
    return out


def _rule_flags(mid: str, lookback: int = 20) -> list[dict]:
    batches = store.batches(mid, lookback)
    trades = store.trades(mid, 500)
    flags = []
    if not batches:
        return flags
    bids = {b["id"]: i for i, b in enumerate(batches)}
    # wash trading: two accounts that only ever trade with each other (>= 2 trades, both directions or same pair repeatedly)
    pair_counts: dict[tuple[str, str], int] = {}
    partner: dict[str, set] = {}
    for t in trades:
        a, b = t["buyer_id"], t["seller_id"]
        if "treasury" in (a, b):
            continue
        key = tuple(sorted((a, b)))
        pair_counts[key] = pair_counts.get(key, 0) + 1
        partner.setdefault(a, set()).add(b)
        partner.setdefault(b, set()).add(a)
    for (a, b), n in pair_counts.items():
        if n >= 2 and partner[a] == {b} and partner[b] == {a}:
            last = [t for t in trades if {t["buyer_id"], t["seller_id"]} == {a, b}][-1]
            flags.append({"id": f"fl_{uuid.uuid5(uuid.NAMESPACE_URL, f'wash:{mid}:{a}:{b}').hex[:10]}", "market_id": mid, "batch_id": last["batch_id"],
                          "rule": "wash_trading", "severity": "high", "subjects": [a, b],
                          "explanation": f"{a} and {b} have traded {n} times and only with each other; volume between them prints price without changing ownership in any real sense.",
                          "reviewer": "rules", "reviews": [{"reviewer": "rules", "severity": "high"}], "disputed": False, "t": last["t"]})
    # pump: clearing price jump > 2 s_m with > 60% of buy volume from one account
    m = store.get_market(mid)
    s_m = m["belief"]["s_m"]
    for prev, b in zip(batches, batches[1:]):
        if not (prev["clearing_price"] and b["clearing_price"]):
            continue
        import math
        jump = math.log(b["clearing_price"] / prev["clearing_price"])
        if jump > 2 * s_m:
            buys = [t for t in trades if t["batch_id"] == b["id"]]
            vol = sum(t["qty"] for t in buys)
            by = {}
            for t in buys:
                by[t["buyer_id"]] = by.get(t["buyer_id"], 0) + t["qty"]
            if vol > 0:
                top, q = max(by.items(), key=lambda kv: kv[1])
                if q / vol > 0.6:
                    flags.append({"id": f"fl_{uuid.uuid5(uuid.NAMESPACE_URL, f'pump:{b['id']}').hex[:10]}", "market_id": mid, "batch_id": b["id"],
                                  "rule": "pump", "severity": "medium", "subjects": [top],
                                  "explanation": f"price moved {jump*100:+.1f}% in one round ({2*s_m*100:.1f}% is the 2 sigma threshold) with {q/vol:.0%} of buy volume from {top}.",
                                  "reviewer": "rules", "reviews": [{"reviewer": "rules", "severity": "medium"}], "disputed": False, "t": b["t"]})
    # concentration: one user holds > 40% of shares outstanding
    for u in store.list_users():
        q = u["positions"].get(mid, {}).get("qty", 0)
        if q > 0.4 * m["shares_outstanding"]:
            flags.append({"id": f"fl_{uuid.uuid5(uuid.NAMESPACE_URL, f'conc:{mid}:{u['id']}').hex[:10]}", "market_id": mid, "batch_id": batches[-1]["id"],
                          "rule": "concentration", "severity": "low", "subjects": [u["id"]],
                          "explanation": f"{u['id']} holds {q:.0f} shares, {q / m['shares_outstanding']:.0%} of the company.",
                          "reviewer": "rules", "reviews": [{"reviewer": "rules", "severity": "low"}], "disputed": False, "t": batches[-1]["t"]})
    # band abuse / halt candidates
    hits = [b for b in batches if b.get("band_hit")]
    if len(hits) >= 2:
        flags.append({"id": f"fl_{uuid.uuid5(uuid.NAMESPACE_URL, f'band:{mid}:{hits[-1]['id']}').hex[:10]}", "market_id": mid, "batch_id": hits[-1]["id"],
                      "rule": "volatility_halt_candidate", "severity": "low", "subjects": [],
                      "explanation": f"{len(hits)} band hits in the last {len(batches)} rounds.",
                      "reviewer": "rules", "reviews": [{"reviewer": "rules", "severity": "low"}], "disputed": False, "t": hits[-1]["t"]})
    return flags


@router.get("/flags", response_model=list[Flag], response_model_by_alias=True)
async def flags(market_id: str | None = None):
    mids = [market_id] if market_id else [m["id"] for m in store.list_markets()]
    out = []
    for mid in mids:
        if store.get_market(mid):
            out.extend(_rule_flags(mid))
    out.sort(key=lambda f: -f["t"])
    from app.llm import is_configured
    if is_configured("xai") or is_configured("ifm"):
        from app.services.agents.compliance import review_flags
        out = await review_flags(out)
    return [views.flag(f) for f in out]
