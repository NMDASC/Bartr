"""Engine dicts -> contract shapes (packages/contracts/types.ts). Internal state keeps float
timestamps and `id`; the wire uses ISO strings and `_id`."""
from __future__ import annotations

import math
from datetime import datetime, timezone

from app.services.market.treasury import SHARES


def iso(t: float | None) -> str | None:
    return None if t is None else datetime.fromtimestamp(t, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def confidence_from_sigma(sigma: float) -> float:
    return round(max(0.0, min(1.0, 1 - sigma)), 2)


def valuation(v: dict, created_at: float) -> dict:
    return {**v, "as_of": v.get("as_of") or iso(created_at)}


def financials(c: dict) -> dict:
    o = c["observables"]
    v = c["valuation"]
    extracted = bool(o.get("sde") or o.get("revenue") or o.get("asking_price"))
    return {"revenue_est": o.get("revenue"), "sde_est": o.get("sde"),
            "margin_est": (o["sde"] / o["revenue"]) if o.get("sde") and o.get("revenue") else None,
            "employees_est": o.get("employees"), "confidence": confidence_from_sigma(v["sigma"]),
            "method": "extracted" if extracted else "proxy"}


def sources(c: dict) -> list[dict]:
    if c.get("source_documents"):
        return c["source_documents"]
    return [{"url": u, "title": u.split("/")[2] if "//" in u else u, "snippet": "", "fetched_at": iso(c["created_at"])}
            for u in c["observables"].get("sources", [])]


def market_summary(m: dict) -> dict:
    b, pr = m["belief"], m["prior"]
    return {"shares_outstanding": m["shares_outstanding"], "float": m["float_shares"], "retained": m["retained"], "tick": 0.01,
            "last_price": m["last_price"], "ref_price": m["ref_price"], "batch_interval_s": m["batch_interval_s"],
            "next_batch_at": iso(m["next_batch_at"]), "band_pct": m["band_pct"],
            "belief": {"mu": b["mu"], "sigma": b["sigma"], "s_m": b["s_m"], "n_rounds": b["n_rounds"],
                       "model_value": math.exp(pr["mu"]), "market_value": math.exp(b["mu"])},
            "treasury": {k: m["treasury"][k] for k in ("unsold_float", "proceeds", "floor_price", "floor_qty", "bought_back", "ask_ladder")},
            "fees_collected": m["fees_collected"], "halted": m["halted"]}


def company(c: dict, m: dict | None) -> dict:
    o = c["observables"]
    yrs = o.get("years_operating")
    return {"_id": c["id"], "name": c["name"], "category": c["category"], "naics_guess": c.get("naics_guess"),
            "address": c.get("address"), "city": c.get("city"), "state": c.get("state"), "lat": c.get("lat"), "lng": c.get("lng"),
            "website": c.get("website"), "phone": c.get("phone"), "rating": o.get("rating"), "review_count": o.get("review_count") or 0,
            "founded_year": (datetime.now().year - yrs) if yrs else None, "owners": c.get("owners", []),
            "description": c.get("description"), "financials": financials(c), "valuation": valuation(c["valuation"], c["created_at"]),
            "sources": sources(c), "status": c.get("status", "ready"), "created_at": iso(c["created_at"]),
            "market": market_summary(m) if m else None, "observables": o}


def card(c: dict, m: dict, book: dict) -> dict:
    o = c["observables"]
    return {"_id": c["id"], "name": c["name"], "category": c["category"], "city": c.get("city"), "state": c.get("state"),
            "rating": o.get("rating"), "review_count": o.get("review_count") or 0,
            "bid": book["bids"][0]["price"] if book["bids"] else None, "ask": book["asks"][0]["price"] if book["asks"] else None,
            "last": m["last_price"], "indicative_price": book["indicative_price"],
            "v0_per_share": round(c["valuation"]["v0"] / SHARES, 2), "confidence": confidence_from_sigma(c["valuation"]["sigma"]),
            "status": c.get("status", "ready")}


def book(m: dict, levels_bids: list[dict], levels_asks: list[dict], indicative: float | None, n_open: int) -> dict:
    last = m["last_price"]
    return {"market_id": m["id"], "bids": levels_bids, "asks": levels_asks, "last": last, "ref": m["ref_price"],
            "indicative_price": indicative, "next_batch_at": iso(m["next_batch_at"]),
            "band": {"pct": m["band_pct"], "low": round(last * (1 - m["band_pct"]), 2) if last else None,
                     "high": round(last * (1 + m["band_pct"]), 2) if last else None},
            "halted": m["halted"], "n_open_orders": n_open}


def order(o: dict) -> dict:
    return {"_id": o["id"], "market_id": o["market_id"], "user_id": o["user_id"], "side": o["side"], "qty": o["qty"],
            "limit_price": o["limit_price"], "status": o["status"], "filled_qty": o["filled_qty"], "origin": o["origin"],
            "created_at": iso(o["created_at"]), "cancelled_at": iso(o.get("cancelled_at"))}


def batch(b: dict, with_snapshot: bool = False) -> dict:
    out = {"_id": b["id"], "market_id": b["market_id"], "t": iso(b["t"]), "clearing_price": b["clearing_price"],
           "volume": b["volume"], "imbalance": round(b["demand"] - b["supply"], 2), "n_buy": b["n_buy"], "n_sell": b["n_sell"],
           "band_hit": b["band_hit"], "ref_moved": b.get("ref_moved", False)}
    if with_snapshot:
        out["book_snapshot"] = {"bids": b["book_snapshot"]["bids"], "asks": b["book_snapshot"]["asks"]}
    return out


def trade(t: dict) -> dict:
    return {**{k: t[k] for k in ("market_id", "batch_id", "buyer_id", "seller_id", "qty", "price")}, "_id": t["id"], "t": iso(t["t"])}


def flag(f: dict) -> dict:
    return {**{k: f[k] for k in ("market_id", "batch_id", "rule", "severity", "subjects", "explanation", "reviewer", "reviews", "disputed")},
            "_id": f["id"], "t": iso(f["t"])}
