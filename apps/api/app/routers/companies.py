"""Company routes. Owner: Zhiyuan. STUBS -- replace bodies, keep signatures."""

from fastapi import APIRouter, HTTPException

from ..examples import example
from ..schemas import Company, CompanyCard

router = APIRouter(tags=["companies"])


@router.get("/companies", response_model=list[CompanyCard])
async def list_companies(
    state: str | None = None,
    category: str | None = None,
    q: str | None = None,
    sort: str | None = None,
) -> list[dict]:
    # TODO(Zhiyuan): Mongo query + text search; filters are already in the contract.
    cards = example("companies")
    if state:
        cards = [c for c in cards if c.get("state") == state]
    if category:
        cards = [c for c in cards if c.get("category") == category]
    return cards


@router.get("/companies/{company_id}", response_model=Company)
async def get_company(company_id: str) -> dict:
    # TODO(Zhiyuan): fetch profile + valuation + sources + market summary.
    company = example("company")
    if company_id in ("", "unknown"):
        raise HTTPException(status_code=404, detail="company not found")
    return {**company, "id": company_id}


@router.post("/companies/{company_id}/refresh", response_model=Company)
async def refresh_company(company_id: str) -> dict:
    # TODO(Zhiyuan): rerun extraction for this company (admin only).
    return {**example("company"), "id": company_id}
