from fastapi import APIRouter, HTTPException, Query

from app.deps import engine, store
from app.schemas import CompanyCard, CompanyIn, CompanyOut, ValuationOut
from app.services.discovery.valuation import Observables, value as run_valuation

router = APIRouter(prefix="/companies", tags=["companies"])


@router.post("", response_model=CompanyOut, status_code=201)
def create_company(body: CompanyIn):
    """Create a company from observables, run the valuation ensemble, open its market.
    Role B's discovery pipeline calls this (or engine.create_company directly) per company."""
    return engine.company_out(engine.create_company(body.model_dump()))


@router.get("", response_model=list[CompanyCard])
def list_companies(state: str | None = None, category: str | None = None, q: str | None = None,
                   sort: str = Query("v0", pattern="^(v0|sigma|last_price|name)$")):
    cs = store.list_companies()
    if state:
        cs = [c for c in cs if (c.get("state") or "").upper() == state.upper()]
    if category:
        cs = [c for c in cs if c["category"] == category]
    if q:
        ql = q.lower()
        cs = [c for c in cs if ql in c["name"].lower() or ql in (c.get("description") or "").lower() or ql in c["category"]]
    cards = [engine.card(c) for c in cs]
    cards.sort(key=lambda x: (x.get(sort) is None, x.get(sort) if x.get(sort) is not None else 0), reverse=(sort != "name"))
    return cards


@router.get("/{cid}", response_model=CompanyOut)
def get_company(cid: str):
    c = store.get_company(cid)
    if not c:
        raise HTTPException(404, "no such company")
    return engine.company_out(c)


@router.post("/valuation/preview", response_model=ValuationOut)
def preview_valuation(body: CompanyIn):
    """Run the ensemble without creating anything. Handy for the UI and for calibration."""
    fields = Observables.__dataclass_fields__.keys()
    v = run_valuation(Observables(**{k: getattr(body, k) for k in fields}))
    return engine._val_dict(v)
