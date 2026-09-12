import math

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.deps import current_user, engine, store
from app.schemas import Portfolio, SuggestIn, Suggestion
from app.services.agents import portfolio_agent
from app.services.market.kelly import size_portfolio
from app.services.market.treasury import SHARES

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("", response_model=Portfolio)
def get_portfolio(uid: str = Depends(current_user)):
    return engine.portfolio(uid)


_profiles: dict[str, dict] = {}


class ProfileIn(BaseModel):
    text: str


@router.post("/profile/parse")
async def parse_profile(body: ProfileIn, uid: str = Depends(current_user)):
    """Free text about yourself and your goals -> RiskProfile (Grok structured). Stored for suggest()."""
    prof = await portfolio_agent.parse_profile(body.text)
    if prof is None:
        prof = {"tolerance": 0.5, "horizon": "medium", "sectors": [], "states": [], "budget": 20000, "summary": body.text[:120], "reviewer": "fallback"}
    else:
        prof["reviewer"] = "grok"
    _profiles[uid] = prof
    return prof


@router.get("/profile")
def get_profile(uid: str = Depends(current_user)):
    return _profiles.get(uid)


@router.post("/suggest", response_model=list[Suggestion], response_model_by_alias=True)
async def suggest(body: SuggestIn | None = None, uid: str = Depends(current_user)):
    """Half Kelly over every market (or the user's filters). value = user's own value if given,
    else the model value. Role D layers vector matching and Grok narrative on top of this."""
    body = body or SuggestIn()
    u = engine.user(uid)
    prof = _profiles.get(uid)
    if prof:   # a parsed profile fills in what the request left blank
        body.states = body.states or prof.get("states", [])
        body.categories = body.categories or prof.get("sectors", [])
        body.bankroll = body.bankroll or min(prof.get("budget", u["cash"]), u["cash"])
        body.kelly_multiplier = 0.25 + 0.75 * float(prof.get("tolerance", 0.33)) if body.kelly_multiplier == 0.5 else body.kelly_multiplier
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
        cands.append({"id": c["id"], "c": c, "price": price, "value": value, "sigma": m["belief"]["sigma"]})
    sized = size_portfolio(cands, bankroll, multiplier=body.kelly_multiplier)
    out = []
    for s in sized:
        if s["usd"] <= 0:
            continue
        c = s["c"]
        out.append({"company": {"_id": c["id"], "name": c["name"], "city": c.get("city"), "state": c.get("state"), "category": c["category"]},
                    "price": s["price"], "model_value": round(s["value"], 2), "edge": round(s["mu"], 4), "sigma": round(s["sigma"], 3),
                    "kelly_fraction": round(s["f"], 4), "suggested_usd": s["usd"],
                    "why": f"model value {s['value']:.2f} vs price {s['price']:.2f} ({s['mu']*100:+.1f}% edge) at sigma {s['sigma']:.2f}; half Kelly {s['f']*100:.1f}% of bankroll"})
    whys = await portfolio_agent.explain(prof, out)
    if whys:
        for o, w in zip(out, whys):
            o["why"] = w
    return out
