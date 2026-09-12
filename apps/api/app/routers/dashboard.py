"""The signed-in session's cross-market orders and activity."""
from fastapi import APIRouter, Depends
from app.deps import current_user, engine, store
from app import views

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

@router.get("/overview")
def overview(uid: str = Depends(current_user)):
    pf = engine.portfolio(uid)
    orders = sorted(store.user_orders(uid), key=lambda o: -o["created_at"])
    visible = [o for o in orders if o["status"] != "rejected"]
    out = []
    for o in visible:
        c = store.get_company(o["market_id"]) or {}
        out.append({**views.order(o), "company_name": c.get("name", o["market_id"]), "category": c.get("category", "business")})
    recent = [e for e in store.audit_log(10000) if e.get("action") != "agent_call" and (e.get("actor") == uid or (e.get("action") == "trade" and uid in (e.get("payload", {}).get("buyer_id"), e.get("payload", {}).get("seller_id"))))][-30:]
    user = store.get_user(uid) or {}
    return {"user_id": uid, "display_name": user.get("display_name", uid), "portfolio": pf,
            "orders": out, "activity": [{**e, "t": views.iso(e["t"])} for e in reversed(recent)],
            "open_orders": sum(o["status"] in ("open", "partial") for o in visible),
            "reserved_cash": engine.reserved_cash(uid), "as_of": views.iso(__import__("time").time())}
