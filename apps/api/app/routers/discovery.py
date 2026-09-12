"""Discovery: POST /discovery/search -> 202 {job_id, intent}; GET /discovery/jobs/{id} streams SSE.

This is the LOCAL implementation so the frontend works against the real API today: intent is
parsed with keyword rules and results come from the companies already in the store. Role B
replaces `parse_intent` (Grok structured output) and `run_job` (Places + Querit + Grok extraction
+ engine.create_company) without touching the routes or the event shapes.
"""
from __future__ import annotations

import asyncio
import json
import re
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.deps import engine, store
from app.schemas import SearchIn, SearchJobAccepted

router = APIRouter(prefix="/discovery", tags=["discovery"])

STATES = {"alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO", "connecticut": "CT",
          "delaware": "DE", "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
          "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI",
          "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH",
          "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
          "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX",
          "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"}
CATEGORIES = {"laundromat": ["laundromat", "laundry", "coin laundry", "wash house"], "car_wash": ["car wash", "carwash"],
              "machine_shop": ["machine shop", "cnc", "machining"], "hvac": ["hvac", "heating", "cooling", "air conditioning"],
              "restaurant": ["restaurant", "diner", "cafe", "grill"], "auto_repair": ["auto repair", "mechanic", "auto shop"],
              "manufacturing": ["manufactur", "kerosene", "factory", "plant"], "landscaping": ["landscap", "lawn"],
              "daycare": ["daycare", "day care", "childcare"], "liquor_store": ["liquor"], "convenience_store": ["convenience", "gas station"],
              "self_storage": ["storage"], "trucking": ["trucking", "freight"], "retail": ["store", "shop", "boutique"]}

CITIES = {"pittsburgh": ("Pittsburgh", "PA"), "squirrel hill": ("Pittsburgh", "PA"), "oakland": ("Pittsburgh", "PA"), "bloomfield": ("Pittsburgh", "PA"),
          "lawrenceville": ("Pittsburgh", "PA"), "south side": ("Pittsburgh", "PA"), "strip district": ("Pittsburgh", "PA"), "shadyside": ("Pittsburgh", "PA"),
          "homestead": ("Homestead", "PA"), "mckees rocks": ("McKees Rocks", "PA"), "tulsa": ("Tulsa", "OK"), "waco": ("Waco", "TX"),
          "philadelphia": ("Philadelphia", "PA"), "cleveland": ("Cleveland", "OH"), "columbus": ("Columbus", "OH")}
PITTSBURGH_METRO = {"Pittsburgh", "Homestead", "McKees Rocks"}

JOBS: dict[str, dict] = {}


def parse_intent(q: str) -> dict:
    ql = q.lower()
    category = "default"
    for cat, kws in CATEGORIES.items():
        if any(k in ql for k in kws):
            category = cat
            break
    state, city = None, None
    for name, (cty, ab) in CITIES.items():
        if re.search(rf"\b{name}\b", ql):
            city, state = cty, ab
            break
    for name, ab in STATES.items():
        if re.search(rf"\b{name}\b", ql):
            state = ab
            break
    if not state:
        m = re.search(r"\b([A-Z]{2})\b", q)
        if m and m.group(1) in STATES.values():
            state = m.group(1)
    money = [float(x.replace(",", "")) * (1_000_000 if u.lower().startswith("m") else 1_000 if u.lower().startswith("k") else 1)
             for x, u in re.findall(r"\$?\s?([\d,.]+)\s*([mMkK]?)", ql) if x.replace(",", "").replace(".", "").isdigit()]
    max_value = max(money) if money and ("under" in ql or "below" in ql or "less than" in ql) else None
    min_value = max(money) if money and ("over" in ql or "above" in ql or "more than" in ql) else None
    return {"category": category, "naics_guess": None, "state": state, "city": city, "min_value": min_value, "max_value": max_value, "must_have": []}


def _matches(c: dict, intent: dict) -> bool:
    if intent["category"] != "default" and c["category"] != intent["category"]:
        return False
    if intent["state"] and (c.get("state") or "").upper() != intent["state"]:
        return False
    if intent["city"]:
        want = PITTSBURGH_METRO if intent["city"] in PITTSBURGH_METRO else {intent["city"]}
        if (c.get("city") or "") not in want:
            return False
    v0 = c["valuation"]["v0"]
    if intent["max_value"] and v0 > intent["max_value"]:
        return False
    if intent["min_value"] and v0 < intent["min_value"]:
        return False
    return True


@router.post("/search", response_model=SearchJobAccepted, status_code=202)
def search(body: SearchIn):
    intent = parse_intent(body.q)
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    JOBS[job_id] = {"q": body.q, "intent": intent}
    return {"job_id": job_id, "intent": intent}


async def run_job(job: dict):
    """Yields DiscoveryEvent dicts. Local: stream matching companies with a small delay each."""
    intent = job["intent"]
    yield {"type": "intent", "intent": intent}
    matches = [c for c in store.list_companies() if _matches(c, intent)]
    if not matches and intent["category"] != "default":
        matches = [c for c in store.list_companies() if c["category"] == intent["category"]]
    for c in matches:
        yield {"type": "company_stub", "company": engine.card(c)}
        await asyncio.sleep(0.25)
        yield {"type": "company_ready", "company": engine.card(c)}
    yield {"type": "done", "total": len(matches)}


@router.get("/jobs/{job_id}")
async def job_stream(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "no such job")

    async def gen():
        async for ev in run_job(job):
            yield f"data: {json.dumps(ev, default=float)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
