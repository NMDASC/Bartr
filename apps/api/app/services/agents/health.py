"""Market health memo: a regulator style summary of the last hour of the audit log."""
from __future__ import annotations

import time

from app.services.agents import grok

SYSTEM = ("You are the head of surveillance at an exchange for fractional shares of small businesses. Write a short memo (five lines max, "
          "no markdown) on market health from the summary statistics and flags given: activity, price stability, owner liquidity usage, "
          "anything that needs a human, and one recommendation.")


def summarize(store, flags: list[dict]) -> dict:
    log = store.audit_log(2000)
    cutoff = time.time() - 3600
    recent = [e for e in log if e["t"] >= cutoff]
    by_action: dict[str, int] = {}
    for e in recent:
        by_action[e["action"]] = by_action.get(e["action"], 0) + 1
    markets = [m for m in store.list_markets() if m.get("listed", True)]
    halted = [m["id"] for m in markets if m["halted"]]
    active = {t["market_id"] for t in store.trades_recent(2000)}
    band_hits = sum(1 for m in markets if m["id"] in active for b in store.batches(m["id"], 30) if b.get("band_hit"))
    proceeds = round(sum(m["treasury"]["proceeds"] for m in markets), 2)
    bought_back = round(sum(m["treasury"]["bought_back"] for m in markets), 2)
    return {"window_minutes": 60, "events": len(recent), "by_action": by_action, "markets": len(markets), "halted": halted,
            "band_hits_last_30_rounds": band_hits, "owner_proceeds_total": proceeds, "owner_bought_back_total": bought_back,
            "flags": [{"rule": f["rule"], "severity": f["severity"], "subjects": f["subjects"], "disputed": f.get("disputed", False)} for f in flags[:15]]}


def fallback_memo(s: dict) -> str:
    return (f"{s['events']} events in the last hour across {s['markets']} markets; {len(s['halted'])} halted; {s['band_hits_last_30_rounds']} band hits. "
            f"Owners sold ${s['owner_proceeds_total']:,.0f} of float and bought back {s['owner_bought_back_total']:.0f} shares. "
            f"{len(s['flags'])} open flags, {sum(1 for f in s['flags'] if f['severity'] == 'high')} high.")


async def memo(store, flags: list[dict]) -> dict:
    s = summarize(store, flags)
    text = await grok.text("health", SYSTEM, str(s), temperature=0.3, cache=False)
    return {"summary": s, "memo": (text or fallback_memo(s)).strip(), "reviewer": "grok" if text else "rules"}
