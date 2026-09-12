"""Market narrator: two lines of tape commentary per market, refreshed when a new round clears."""
from __future__ import annotations

from app.services.agents import grok

SYSTEM = ("You write the two line ticker commentary for one company's market on a fractional share exchange. "
          "Line 1: what the last rounds did (price, volume, who was on which side: owner, bots, users). "
          "Line 2: what it implies about the owner's ask ladder or the model value. Plain language, numbers with $ and two decimals, no markdown, no hype.")

_last: dict[str, tuple[str, str]] = {}   # market_id -> (batch_id, text)


async def narrate(c: dict, m: dict, batches: list[dict], trades: list[dict]) -> str | None:
    priced = [b for b in batches if b["clearing_price"] is not None]
    if not priced:
        return None
    key = priced[-1]["id"]
    if m["id"] in _last and _last[m["id"]][0] == key:
        return _last[m["id"]][1]
    rounds = [{"p": b["clearing_price"], "vol": b["volume"], "n_buy": b["n_buy"], "n_sell": b["n_sell"], "band_hit": b["band_hit"]} for b in priced[-6:]]
    by_side: dict[str, float] = {}
    for t in trades[-40:]:
        for who, side in ((t["buyer_id"], "buy"), (t["seller_id"], "sell")):
            k = ("owner" if who == "treasury" else "bot" if who.startswith("bot") else "user") + "_" + side
            by_side[k] = round(by_side.get(k, 0) + t["qty"], 1)
    user = (f"{c['name']} ({c['category']}, {c.get('city')}). Model value per share ${m['ref_price']:.2f}, market implied "
            f"${(m['belief']['mu'] and __import__('math').exp(m['belief']['mu']) / m['shares_outstanding']):.2f}, last ${m['last_price']}. "
            f"Owner unsold float {m['treasury']['unsold_float']:.0f}, floor ${m['treasury']['floor_price']}, "
            f"ask ladder {[l['price'] for l in m['treasury']['ask_ladder']]}. Rounds (oldest first): {rounds}. Volume by side: {by_side}.")
    out = await grok.text("narrate", SYSTEM, user, temperature=0.5)
    if out:
        _last[m["id"]] = (key, out.strip())
    return out.strip() if out else None
