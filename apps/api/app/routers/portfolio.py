"""Portfolio routes. Owner: Aditya. STUBS -- replace bodies, keep signatures."""

from typing import Any

from fastapi import APIRouter, Depends

from ..examples import example
from ..identity import get_current_user
from ..schemas import Portfolio, RiskProfile, Suggestion

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("", response_model=Portfolio)
async def get_portfolio(user: dict[str, Any] = Depends(get_current_user)) -> dict:
    # TODO(Aditya): real positions + mark to last clearing price.
    return {**example("portfolio"), "cash": user.get("cash", 100_000.0)}


@router.put("/profile", response_model=RiskProfile)
async def put_profile(
    body: RiskProfile,
    user: dict[str, Any] = Depends(get_current_user),
) -> RiskProfile:
    # TODO(Aditya): persist to users.risk_profile and re-embed for vector search.
    return body


@router.post("/suggest", response_model=list[Suggestion])
async def suggest(user: dict[str, Any] = Depends(get_current_user)) -> list[dict]:
    # TODO(Aditya): vector search candidates -> Kelly sizing -> one-line narrative.
    return example("suggestions")
