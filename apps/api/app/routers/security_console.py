"""Persistent cases, linked evidence, agent transcripts, and human dispositions."""
from __future__ import annotations
import asyncio
import time
import uuid
from threading import RLock
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app import views
from app.deps import store
from app.security import require_admin
from app.routers.surveillance import _all_flags

router = APIRouter(prefix="/security", tags=["security"], dependencies=[Depends(require_admin)])
_cases_lock = RLock()


def capture(flags=None):
    with _cases_lock:
        existing = {c["id"]: c for c in store.list_cases()}
        for flag in flags if flags is not None else _all_flags():
            old = existing.get(flag["id"])
            if old and old["flag"].get("t", 0) > flag["t"]:
                continue
            if old and flag["rule"] == "concentration":
                prior_rules = next((r for r in old["flag"].get("reviews", []) if r["reviewer"] == "rules"), {})
                if prior_rules.get("explanation", old["flag"]["explanation"]) == flag["explanation"]:
                    flag = old["flag"]
            updated = old is None or flag["t"] > old["flag"]["t"]
            case = dict(old or {"id": flag["id"], "status": "open", "note": "", "history": [], "first_seen": flag["t"], "occurrences": 0})
            if updated:
                case["occurrences"] += 1
                if case["status"] in ("resolved", "dismissed"):
                    case["status"] = "open"
                    case["history"].append({"t": views.iso(time.time()), "actor": "system", "status": "open", "note": "New evidence detected after the previous review."})
            # Do not lose model opinions when merely refreshing the deterministic rules.
            if old and not updated and len(flag.get("reviews", [])) < len(old["flag"].get("reviews", [])):
                flag = old["flag"]
            if updated:
                subjects = set(flag["subjects"])
                trades = [t for t in store.trades(flag["market_id"], 1000) if t["batch_id"] == flag["batch_id"] or subjects.intersection((t["buyer_id"], t["seller_id"]))]
                orders = [o for uid in subjects for o in store.user_orders(uid, flag["market_id"])]
                case["evidence"] = {"trades": [views.trade(t) for t in trades[-100:]], "orders": [views.order(o) for o in orders[-100:]], "batches": [views.batch(b, True) for b in store.batches(flag["market_id"], 500) if b["id"] == flag["batch_id"]]}
                store.audit({"id": f"detection_{uuid.uuid4().hex[:16]}", "t": time.time(), "actor": "rules_engine",
                             "action": "security_detection", "market_id": flag["market_id"], "flag_id": flag["id"],
                             "payload": {"flag": views.flag(flag), "evidence": case["evidence"]}})
            case["flag"] = flag
            case["last_seen"] = flag["t"]
            store.put_case(case)
        if hasattr(store, "save"):
            store.save()
        return store.list_cases()


def wire_case(case):
    f = case["flag"]
    c = store.get_company(f["market_id"]) or {}
    return {"id": case["id"], "flag": views.flag(f), "status": case["status"], "note": case["note"],
            "history": case["history"], "company_name": c.get("name", f["market_id"]),
            "category": c.get("category", "business"), "occurrences": case["occurrences"],
            "first_seen": views.iso(case["first_seen"]), "last_seen": views.iso(case["last_seen"])}


@router.get("/overview")
def overview():
    as_of = time.time()
    cases = sorted(capture(), key=lambda c: -c["last_seen"])
    rows = [wire_case(c) for c in cases]
    calls = [{**e, "t": views.iso(e["t"])} for e in store.audit_page(True, as_of, 0, 500)]
    counts = store.audit_counts()
    assets = {}
    users = {}
    for c in rows:
        f = c["flag"]
        a = assets.setdefault(f["market_id"], {"id": f["market_id"], "name": c["company_name"], "flags": 0, "high": 0, "occurrences": 0, "users": set(), "rules": set()})
        a["flags"] += 1
        a["high"] += int(f["severity"] == "high")
        a["occurrences"] += c["occurrences"]
        a["users"].update(f["subjects"])
        a["rules"].add(f["rule"])
        for uid in f["subjects"]:
            u = users.setdefault(uid, {"id": uid, "flags": 0, "high": 0, "assets": set(), "rules": set()})
            u["flags"] += 1
            u["high"] += int(f["severity"] == "high")
            u["assets"].add(f["market_id"])
            u["rules"].add(f["rule"])
    from app.llm import is_configured
    return {"cases": rows, "assets": [{**a, "users": sorted(a["users"]), "rules": sorted(a["rules"])} for a in sorted(assets.values(), key=lambda a: -a["flags"])],
            "users": [{**u, "assets": sorted(u["assets"]), "rules": sorted(u["rules"])} for u in sorted(users.values(), key=lambda u: -u["flags"])],
            "calls": calls, "audit": [{**e, "t": views.iso(e["t"])} for e in store.audit_page(False, as_of, 0, 500)],
            "summary": {"open": sum(c["status"] in ("open", "investigating") for c in rows), "high": sum(c["flag"]["severity"] == "high" and c["status"] in ("open", "investigating") for c in rows),
                        "disputed": sum(c["flag"]["disputed"] for c in rows), "markets": len(store.list_markets()), "agent_calls": counts["calls"], "agent_errors": counts["errors"]},
            "providers": {"grok": is_configured("xai"), "k2": is_configured("ifm")}, "as_of": views.iso(as_of),
            "audit_window": "Export includes the latest 500 events per feed. Search and load older events in the transcript and audit tabs to inspect all stored history."}


@router.get("/events")
def events(kind: Literal["agents", "audit"] = "agents", before: float | None = Query(default=None, ge=0, allow_inf_nan=False),
           offset: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=500),
           query: str = Query(default="", max_length=200)):
    anchor = before if before is not None else time.time()
    rows = store.audit_page(kind == "agents", anchor, offset, limit + 1, query.strip())
    return {"items": [{**e, "t": views.iso(e["t"])} for e in rows[:limit]], "before": anchor,
            "next_offset": offset + limit if len(rows) > limit else None}


@router.get("/cases/{cid}")
def detail(cid: str):
    case = next((c for c in store.list_cases() if c["id"] == cid), None)
    if not case:
        raise HTTPException(404, "Case not found")
    f = case["flag"]
    subjects = set(f["subjects"])
    trades = [t for t in store.trades(f["market_id"], 1000) if t["batch_id"] == f["batch_id"] or subjects.intersection((t["buyer_id"], t["seller_id"]))]
    orders = [o for uid in subjects for o in store.user_orders(uid, f["market_id"])]
    evidence = {"trades": [views.trade(t) for t in trades[-100:]], "orders": [views.order(o) for o in orders[-100:]],
                "batches": [views.batch(b, True) for b in store.batches(f["market_id"], 500) if b["id"] == f["batch_id"]]}
    # Evidence belongs to the detection time. Opening a case must not replace it
    # with later activity from the same subjects or mutate the saved record.
    return {**wire_case(case), **case.get("evidence", evidence),
            "audit": [{**e, "t": views.iso(e["t"])} for e in store.linked_audit(actors=list(subjects), flag_ids=[cid], market_id=f["market_id"], limit=100)],
            "evidence_window": "Detection snapshot: up to 100 trades and 100 orders. Audit shows the latest 100 linked records from all stored history."}


class Disposition(BaseModel):
    status: Literal["open", "investigating", "resolved", "dismissed"]
    note: str = Field(min_length=1, max_length=2000)


@router.patch("/cases/{cid}")
def review(cid: str, body: Disposition):
    with _cases_lock:
        case = next((c for c in store.list_cases() if c["id"] == cid), None)
        if not case:
            raise HTTPException(404, "Case not found")
        if not body.note.strip():
            raise HTTPException(422, "Add a review note")
        entry = {"t": views.iso(time.time()), "actor": "administrator", "status": body.status, "note": body.note.strip()}
        case.update(status=body.status, note=body.note.strip())
        case["history"].append(entry)
        store.put_case(case)
        store.audit({"id": f"audit_{uuid.uuid4().hex[:12]}", "t": time.time(), "actor": "administrator", "action": "case_review", "flag_id": cid, "market_id": case["flag"]["market_id"], "payload": entry})
        if hasattr(store, "save"):
            store.save()
        return wire_case(case)


_review_lock = asyncio.Lock()

@router.post("/review")
async def model_review():
    if _review_lock.locked():
        raise HTTPException(409, "A review is already running")
    async with _review_lock:
        from app.services.agents.compliance import review_flags
        from app.llm import is_configured
        expected = {name for provider, name in (("xai", "grok"), ("ifm", "k2")) if is_configured(provider)}
        cases = await asyncio.to_thread(capture)
        pending = [c["flag"] for c in cases if expected.difference(r["reviewer"] for r in c["flag"].get("reviews", []))]
        reviewed = await review_flags(pending[:3])
        await asyncio.to_thread(capture, reviewed)
    completed = sum(expected.issubset({r["reviewer"] for r in flag["reviews"]}) for flag in reviewed)
    return {"reviewed": completed, "remaining": len(pending) - completed}


async def monitor():
    while True:
        try:
            cases = await asyncio.to_thread(capture)
            import os
            from app.llm import is_configured
            if os.getenv("SECURITY_AUTO_REVIEW", "1") == "1" and (is_configured("xai") or is_configured("ifm")) and not _review_lock.locked():
                async with _review_lock:
                    from app.services.agents.compliance import review_flags
                    expected = {name for provider, name in (("xai", "grok"), ("ifm", "k2")) if is_configured(provider)}
                    pending = [c["flag"] for c in sorted(cases, key=lambda c: -c["last_seen"]) if expected.difference(r["reviewer"] for r in c["flag"].get("reviews", []))][:5]
                    if pending:
                        reviewed = await review_flags(pending)
                        await asyncio.to_thread(capture, reviewed)
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Security case capture failed")
        await asyncio.sleep(15)


@router.get("/users/{uid}")
def user_profile(uid: str):
    user = store.get_user(uid)
    cases = [wire_case(c) for c in store.list_cases() if uid in c["flag"]["subjects"]]
    if not user and not cases:
        raise HTTPException(404, "No user or investigation found")
    orders = sorted(store.user_orders(uid), key=lambda o: (o["created_at"], o["id"]))
    trades = store.user_trades(uid, limit=100)
    trade_summary = store.user_trade_summary(uid)
    calls = [{**e, "t": views.iso(e["t"])} for e in store.linked_audit(actors=[uid], flag_ids=[c["id"] for c in cases], calls_only=True, limit=100)]
    return {"id": uid, "display_name": (user or {}).get("display_name", uid), "cases": cases,
            "summary": {"orders": len(orders), "cancelled": sum(o["status"]=="cancelled" for o in orders), **trade_summary},
            "positions": (user or {}).get("positions", {}), "orders": [views.order(o) for o in orders[-100:]], "trades": [views.trade(t) for t in trades], "calls": calls,
            "evidence_window": "Totals cover all stored history. Lists show up to 100 recent orders, trades, and linked agent records."}
