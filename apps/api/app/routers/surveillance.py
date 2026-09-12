from fastapi import APIRouter

from app.deps import store

router = APIRouter(prefix="/surveillance", tags=["surveillance"])


@router.get("/audit")
def audit(limit: int = 200, actor: str | None = None):
    log = store.audit_log(limit * 5 if actor else limit)
    if actor:
        log = [e for e in log if e.get("actor") == actor][-limit:]
    return log


@router.get("/treasury")
def treasury_summary():
    """Owner proceeds and buybacks per market, plus fees. The two numbers on the surveillance page."""
    out = []
    for m in store.list_markets():
        c = store.get_company(m["id"])
        t = m["treasury"]
        out.append({"market_id": m["id"], "name": c["name"], "proceeds": t["proceeds"], "unsold_float": t["unsold_float"],
                    "bought_back": t["bought_back"], "floor_price": t["floor_price"], "fees_collected": m["fees_collected"]})
    return out
