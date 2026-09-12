import math

from fastapi import APIRouter, Depends

from app.deps import current_user, engine, store
from app.schemas import PortfolioOut, SuggestIn, SuggestionOut
from app.services.market.kelly import size_portfolio
from app.services.market.treasury import SHARES

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("", response_model=PortfolioOut)
def get_portfolio(uid: str = Depends(current_user)):
    return engine.portfolio(uid)


@router.post("/suggest", response_model=list[SuggestionOut])
def suggest(body: SuggestIn, uid: str = Depends(current_user)):
    """Half Kelly over every market (or the user's filters). value = user's own value if given,
    else the model value. Role D layers vector matching and Grok narrative on top of this."""
    u = engine.user(uid)
    bankroll = body.bankroll or u["cash"]
    cands = []
    for c in store.list_companies():
        if body.states and (c.get("state") or "").upper() not in [s.upper() for s in body.states]:
            continue
        if body.categories and c["category"] not in body.categories:
            continue
        if body.exclude_held and c["id"] in u["positions"]:
            continue
        m = store.get_market(c["id"])
        price = m["last_price"] or m["ref_price"]
        value = body.own_values.get(c["id"]) or (math.exp(m["prior"]["mu"]) / SHARES)
        cands.append({"market_id": c["id"], "name": c["name"], "price": price, "value": value, "sigma": m["belief"]["sigma"]})
    sized = size_portfolio(cands, bankroll, multiplier=body.kelly_multiplier)
    out = []
    for s in sized:
        if s["usd"] <= 0:
            continue
        why = f"model value {s['value']:.2f} vs price {s['price']:.2f} ({s['mu']*100:+.1f}% edge) at sigma {s['sigma']:.2f}; half Kelly {s['f']*100:.1f}% of bankroll"
        out.append({**s, "why": why})
    return out
