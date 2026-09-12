from fastapi import APIRouter, HTTPException, Query

from app import views
from app.deps import engine, store
from app.schemas import Company, CompanyCard, CompanyIn, Valuation
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
    fields = Observables.__dataclass_fields__.keys()
    v = run_valuation(Observables(**{k: getattr(body, k) for k in fields}))
    import time
    return views.valuation(engine._val_dict(v), time.time())
