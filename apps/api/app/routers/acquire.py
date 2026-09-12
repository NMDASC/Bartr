"""Acquire: POST /acquire/{company_id}/start -> Acquisition {loi_md, checklist}.

Templated LOI plus a state/category checklist. PA and Pittsburgh items carry
official citations so the acquire demo does not wait on a model call.
"""
from __future__ import annotations

import asyncio
import json
import uuid
import time
from datetime import date
from pathlib import Path
from copy import deepcopy
from threading import RLock

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import current_user, store
from app.schemas import Acquisition, ChecklistItem
from pydantic import BaseModel, Field
from app.services.market.treasury import SHARES

router = APIRouter(prefix="/acquire", tags=["acquire"])

# Researched checklists cached by (city, state, category). Pre-warmed from seeds/checklists.json
# (scripts/warm_checklists.py) so the demo companies get the cited version instantly; anything
# else gets the template now and the researched version a minute later via GET /acquire/{id}.
CHECKLISTS: dict[str, list[dict]] = {}
_CHECKLIST_FILE = Path(__file__).resolve().parent.parent.parent / "seeds" / "checklists.json"
if _CHECKLIST_FILE.exists():
    CHECKLISTS.update(json.loads(_CHECKLIST_FILE.read_text()))


def _ck(c: dict) -> str:
    return f"{c.get('city')}|{c.get('state')}|{c['category']}"


_draft_lock = RLock()
_start_locks: dict[tuple[str, str], asyncio.Lock] = {}
_research_tasks: set[asyncio.Task] = set()
_research_jobs: dict[tuple[str, str, str], asyncio.Task] = {}


def _persist(uid: str, cid: str, draft: dict) -> None:
    store.put_draft(uid, cid, draft)
    if hasattr(store, "save"):
        store.save()


def _mark_unavailable(uid: str, cid: str, acq_id: str) -> None:
    """End an interrupted job without touching a saved letter or checklist."""
    with _draft_lock:
        draft = store.get_draft(uid, cid)
        if draft and draft["acquisition_id"] == acq_id and draft.get("checklist_status") == "researching":
            draft["checklist_status"] = "unavailable"
            _persist(uid, cid, draft)


def _recover_draft(uid: str, cid: str) -> dict | None:
    """A persisted research badge must correspond to a job in this API worker.

    After a restart there is no safe running job to poll. Keep the saved document
    intact and expose the existing unavailable state instead of polling forever.
    """
    with _draft_lock:
        draft = store.get_draft(uid, cid)
        if draft and draft.get("checklist_status") == "researching":
            task = _research_jobs.get((uid, cid, draft["acquisition_id"]))
            if task is None or task.done():
                draft["checklist_status"] = "unavailable"
                _persist(uid, cid, draft)
        return draft


def _research_finished(key: tuple[str, str, str], task: asyncio.Task) -> None:
    with _draft_lock:
        _research_tasks.discard(task)
        if _research_jobs.get(key) is task:
            _research_jobs.pop(key, None)
        # This also covers cancellation before the coroutine ever starts, when
        # its exception handler cannot run, and unexpected worker failures.
        if task.cancelled() or task.exception() is not None:
            _mark_unavailable(*key)


async def _research_checklist(uid: str, acq_id: str, c: dict, original: list[dict]) -> None:
    from app.services.agents import acquire_agent
    try:
        items = await acquire_agent.checklist(c)
    except asyncio.CancelledError:
        _mark_unavailable(uid, c["id"], acq_id)
        raise
    except Exception:
        items = None
    with _draft_lock:
        if items:
            CHECKLISTS[_ck(c)] = deepcopy(items)
        draft = store.get_draft(uid, c["id"])
        if not draft or draft["acquisition_id"] != acq_id:
            return
        # A saved checklist belongs to the buyer; research must not replace edits.
        if draft["checklist"] != original:
            draft["checklist_status"] = "kept"
        elif items:
            draft.update(checklist=deepcopy(items), checklist_source="grok", checklist_status="ready")
        else:
            draft["checklist_status"] = "unavailable"
        _persist(uid, c["id"], draft)


GENERIC = [
    ("Three years of tax returns and P&L", "Verify the SDE the price is built on"),
    ("Lease assignment consent from the landlord", "Most small business value is location; the lease must transfer"),
    ("UCC lien search on equipment", "Equipment may be collateral on an existing loan"),
    ("Asset purchase agreement, not stock", "Buyer avoids inheriting unknown liabilities"),
    ("Non compete from the seller (3 years, county radius)", "The seller knows every customer"),
    ("Transition period with the owner (30 to 90 days)", "Owner operated businesses lose customers when the owner leaves"),
]
BY_CATEGORY = {
    "laundromat": [("Utility bills, 24 months, water and gas", "Utilities are the largest cost and reveal true volume"),
                   ("Machine age and service records", "Replacement cost of a 38 machine floor runs six figures"),
                   ("Card system vendor contract", "Payment systems often carry multi year contracts")],
    "car_wash": [("Water reclamation and environmental permits", "Wash water discharge is regulated"),
                 ("Membership count and churn", "Recurring revenue is the valuation driver")],
    "restaurant": [("Health department inspection history", "Permits transfer only with a clean record"),
                   ("Liquor license transfer eligibility", "Licenses are state specific and can take months")],
    "machine_shop": [("Customer concentration by revenue", "One aerospace contract can be half the business"),
                     ("ISO or AS9100 certification status", "Certifications are tied to the entity and process")],
    "hvac": [("State contractor license transfer", "Licenses are personal in many states"),
             ("Maintenance contract book", "Recurring contracts are the durable value")],
    "auto_repair": [("Environmental: waste oil, solvent handling", "Shops carry cleanup risk"),
                    ("Technician retention agreements", "ASE certified staff are the business")],
}
BY_STATE = {
    "OK": [("Oklahoma sales tax permit transfer (OTC)", "New owner needs their own permit before the first sale"),
           ("Oklahoma Secretary of State entity filing", "Assumed name or new LLC registration")],
    "TX": [("Texas Comptroller sales tax permit", "Required before operating"),
           ("Bulk sale notice to Comptroller for tax clearance", "Buyer can be liable for seller's unpaid sales tax")],
    "PA": [("PA bulk sale clearance certificate (REV-181)", "Protects the buyer from the seller's tax liabilities"),
           ("PA sales tax license (myPATH)", "Licenses do not transfer; apply before the first sale"),
           ("PA Department of State fictitious name or new LLC filing", "Trade name must be registered to the new entity")],
}
BY_CITY = {
    "Pittsburgh": [("City of Pittsburgh business registration and payroll expense tax", "Every business operating in the city registers with Finance"),
                   ("Allegheny County Health Department permit (food, laundromat water discharge)", "County permits are issued to the operator, not the location")],
    "Homestead": [("Borough of Homestead business privilege license", "Municipal license required to operate")],
    "McKees Rocks": [("Borough business privilege and mercantile tax registration", "Local tax registration for the new owner")],
    "OH": [("Ohio vendor's license", "County issued, does not transfer")],
}


def draft_loi(c: dict, m: dict, buyer: str) -> str:
    px = m["last_price"] or m["ref_price"]
    total = px * SHARES
    seller = ", ".join(c.get("owners") or ["the owner"])
    where = ", ".join(x for x in (c.get("address"), ) if x) or ", ".join(x for x in (c.get("city"), c.get("state")) if x)
    return f"""# Non-Binding Letter of Intent

**Buyer:** {buyer}
**Seller:** {seller}, owner of {c['name']}
**Target:** {c['name']}, {where}
**Date:** {date.today().strftime('%B %d, %Y')}

## 1. Proposed consideration
Purchase price of **${total:,.0f}** for 100 percent of the assets, derived from the exchange's last clearing price of ${px:.2f} per share across {SHARES:,} shares. Subject to adjustment for working capital and verified seller's discretionary earnings.

## 2. Structure
Asset purchase. Buyer acquires the equipment, leasehold improvements, customer lists, and trade name free of liens. Buyer does not assume liabilities except the premises lease, subject to landlord consent. Up to 20 percent of the price is held back for 12 months against undisclosed liabilities.

## 3. Diligence period
45 days from execution, during which Seller grants access to three years of tax returns, revenue reports, utility bills, equipment service records, and the premises lease. See the attached checklist.

## 4. Exclusivity
Seller agrees not to solicit competing offers for 30 days from execution.

## 5. Transition
Seller provides 60 days of transition support and a 3 year non compete within the county.

## 6. Non-binding
This letter states intent only and creates no obligation to complete a transaction, except sections 4 and 7.

## 7. Confidentiality
Both parties keep the existence and terms of this letter confidential.
"""


def citation_for(item: str) -> dict | None:
    key = item.lower()
    if "rev-181" in key or "bulk sale" in key:
        return {"url": "https://www.revenue.pa.gov/", "title": "Pennsylvania Department of Revenue"}
    if "mypath" in key or "sales tax license" in key:
        return {"url": "https://www.pa.gov/agencies/revenue/resources/mypath.html", "title": "PA myPATH sales tax"}
    if "fictitious name" in key or "department of state" in key:
        return {"url": "https://www.dos.pa.gov/BusinessCharities/Business/Pages/default.aspx", "title": "PA Department of State"}
    if "city of pittsburgh" in key:
        return {"url": "https://pittsburghpa.gov/finance/", "title": "City of Pittsburgh Finance"}
    if "allegheny county" in key:
        return {"url": "https://www.alleghenycounty.us/Services/Health-Department", "title": "Allegheny County Health Department"}
    if "ucc" in key:
        return {"url": "https://www.dos.pa.gov/BusinessCharities/UCC/Pages/default.aspx", "title": "Pennsylvania UCC search"}
    if "oklahoma sales tax" in key or "otc" in key:
        return {"url": "https://oklahoma.gov/tax.html", "title": "Oklahoma Tax Commission"}
    if "texas comptroller" in key:
        return {"url": "https://comptroller.texas.gov/taxes/sales/", "title": "Texas Comptroller, sales tax"}
    return None


def checklist_for(c: dict) -> list[dict]:
    items = GENERIC + BY_CATEGORY.get(c["category"], []) + BY_STATE.get((c.get("state") or "").upper(), []) + BY_CITY.get(c.get("city") or "", [])
    return [{"item": i, "why": w, "citation": citation_for(i), "done": False} for i, w in items]


@router.post("/{cid}/start", response_model=Acquisition, status_code=201)
async def start(cid: str, uid: str = Depends(current_user)):
    # Serialize only duplicate starts for this buyer and company.
    async with _start_locks.setdefault((uid, cid), asyncio.Lock()):
        from app.services.agents import acquire_agent
        c = store.get_company(cid)
        if not c:
            raise HTTPException(404, "no such company")
        existing = _recover_draft(uid, cid)
        if existing:
            return existing
        m = store.get_market(cid)
        if not m:
            raise HTTPException(409, "This business has not been priced yet")
        px = m["last_price"] or m["ref_price"]
        seller = ", ".join(c.get("owners") or ["the owner"])
        where = c.get("address") or ", ".join(x for x in (c.get("city"), c.get("state")) if x)
        generated = await acquire_agent.loi(c, uid, seller, where, px, px * SHARES, date.today().strftime("%B %d, %Y"))
        cached = CHECKLISTS.get(_ck(c))
        acq = {"acquisition_id": f"acq_{uuid.uuid4().hex[:8]}", "market_id": cid,
               "loi_md": generated or draft_loi(c, m, uid), "status": "draft",
               "checklist": deepcopy(cached) if cached else checklist_for(c),
               "checklist_source": "grok" if cached else "template", "loi_source": "grok" if generated else "template",
               "checklist_status": "ready" if cached else "researching"}
        with _draft_lock:
            _persist(uid, cid, acq)
            store.audit({"t": time.time(), "actor": uid, "action": "acquire_start", "payload": {"market_id": cid, "acquisition_id": acq["acquisition_id"]}})
            if not cached:
                key = (uid, cid, acq["acquisition_id"])
                task = asyncio.create_task(_research_checklist(uid, acq["acquisition_id"], c, deepcopy(acq["checklist"])))
                _research_tasks.add(task)
                _research_jobs[key] = task
                task.add_done_callback(lambda finished, key=key: _research_finished(key, finished))
        return acq


@router.get("/{acq_id}", response_model=Acquisition)
def get(acq_id: str, uid: str = Depends(current_user)):
    a = next((a for a in store.user_drafts(uid) if a["acquisition_id"] == acq_id), None)
    if not a:
        raise HTTPException(404, "no such acquisition")
    return _recover_draft(uid, a["market_id"])


@router.get("/{cid}/draft", response_model=Acquisition | None)
def draft(cid: str, uid: str = Depends(current_user)):
    return _recover_draft(uid, cid)


class DraftIn(BaseModel):
    loi_md: str = Field(min_length=1, max_length=100000)
    checklist: list[ChecklistItem] = Field(max_length=100)
    checklist_source: str = "template"


@router.put("/{cid}/draft", response_model=Acquisition)
def save_draft(cid: str, body: DraftIn, uid: str = Depends(current_user)):
    with _draft_lock:
        acq = _recover_draft(uid, cid)
        if not acq:
            raise HTTPException(404, "Create a draft first")
        items = [i.model_dump() for i in body.checklist]
        changed = items != acq["checklist"]
        acq = {**acq, "loi_md": body.loi_md, "checklist": items}
        if changed:
            acq["checklist_source"] = "grok" if body.checklist_source == "grok" else "template"
            acq["checklist_status"] = "kept"
        store.audit({"t": time.time(), "actor": uid, "action": "acquire_draft_saved", "payload": {"market_id": cid, "acquisition_id": acq["acquisition_id"]}})
        _persist(uid, cid, acq)
        return acq
