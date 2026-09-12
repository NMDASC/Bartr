import math
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app import views
from app.deps import current_user, engine, store
from app.schemas import Company, CompanyCard, CompanyIn, Valuation
from app.services.agents import appraiser, persona
from app.services.discovery.valuation import Observables, value as run_valuation

router = APIRouter(prefix="/companies", tags=["companies"])


@router.post("", response_model=Company, status_code=201, response_model_by_alias=True)
def create_company(body: CompanyIn):
    """Create a company from observables, run the valuation ensemble, open its market.
    Role B's discovery pipeline calls this (or engine.create_company directly) per company."""
    return engine.company_out(engine.create_company(body.model_dump()))


@router.get("", response_model=list[CompanyCard], response_model_by_alias=True)
def list_companies(state: str | None = None, category: str | None = None, q: str | None = None,
                   sort: str = Query("v0", pattern="^(v0|confidence|last|name)$")):
    cs = store.list_companies()
    if state:
        cs = [c for c in cs if (c.get("state") or "").upper() == state.upper()]
    if category:
        cs = [c for c in cs if c["category"] == category]
    if q:
        ql = q.lower()
        cs = [c for c in cs if ql in c["name"].lower() or ql in (c.get("description") or "").lower() or ql in c["category"] or ql in (c.get("city") or "").lower()]
    cards = [engine.card(c) for c in cs]
    key = {"v0": "v0_per_share", "confidence": "confidence", "last": "last", "name": "name"}[sort]
    cards.sort(key=lambda x: (x.get(key) is None, x.get(key) if x.get(key) is not None else 0), reverse=(sort != "name"))
    return cards


@router.get("/{cid}", response_model=Company, response_model_by_alias=True)
def get_company(cid: str):
    c = store.get_company(cid)
    if not c:
        raise HTTPException(404, "no such company")
    return engine.company_out(c)


@router.post("/valuation/preview", response_model=Valuation)
def preview_valuation(body: CompanyIn):
    """Run the ensemble without creating anything. Handy for the UI and for calibration."""
    from app.services.discovery.pricing import preview
    try:
        return preview(body.model_dump())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/{cid}/appraise", response_model=Company, response_model_by_alias=True)
async def appraise(cid: str):
    """Grok researches the business on the web and gives a value with sources; K2 gives a second number.
    Both feed the ensemble's `llm` estimator and the valuation is recomputed. The market prior is
    re-anchored only if nothing has traded yet; after that the belief already reflects the market."""
    c = store.get_company(cid)
    if not c:
        raise HTTPException(404, "no such company")
    res = await appraiser.appraise(c)
    if res is None:
        raise HTTPException(503, "appraiser not available: set XAI_API_KEY")
    obs = {**c["observables"], **res["patch"]}
    if res["appraisal"].get("sources"):
        obs["sources"] = sorted(set(obs.get("sources", [])) | set(res["appraisal"]["sources"]))
    fields = [k for k in Observables.__dataclass_fields__.keys() if k != "sources"]
    v = run_valuation(Observables(**{k: obs.get(k) for k in fields}, sources=obs.get("sources", [])))
    c["observables"] = obs
    c["valuation"] = engine._val_dict(v)
    c["appraisal"] = {**res["appraisal"], "k2": res["k2"], "clamped": res["clamped"], "at": time.time()}
    if res["appraisal"].get("owners") and not c.get("owners"):
        c["owners"] = res["appraisal"]["owners"]
    store.put_company(c)
    m = store.get_market(cid)
    if m and m["belief"]["n_rounds"] == 0:
        m["prior"] = {"mu": math.log(v.v0), "sigma": v.sigma}
        m["belief"].update(mu=math.log(v.v0), sigma=v.sigma)
        m["ref_price"] = round(v.v0 / 10_000, 2)
        engine._requote(m)
        store.put_market(m)
    store.audit({"t": time.time(), "actor": "grok", "action": "appraise", "payload": {"company": cid, "v0": v.v0, "sigma": v.sigma, "clamped": res["clamped"]}})
    return engine.company_out(c)


class AskIn(BaseModel):
    question: str
    history: list[dict] = []


@router.post("/{cid}/ask")
async def ask_owner(cid: str, body: AskIn, uid: str = Depends(current_user)):
    """Talk to the AI version of the owner, grounded in the file (profile, valuation, sources)."""
    c = store.get_company(cid)
    if not c:
        raise HTTPException(404, "no such company")
    out = await persona.ask(c, store.get_market(cid), body.question, body.history)
    store.audit({"t": time.time(), "actor": uid, "action": "ask_owner", "payload": {"company": cid, "q": body.question[:200], "grounded": out["grounded"]}})
    return out
