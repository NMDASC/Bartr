"""Validated valuation snapshots and idempotent company enrichment through Store."""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import time
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlsplit

from app.services.market.treasury import SHARES
from app.views import iso
from .models import CalibrationProfile, ExtractedCompany
from .valuation import Observables, value
from .benchmark_catalog import CATALOG

VERSION = "evidence-ensemble-v1"
FINANCIAL = {"revenue", "sde", "asking_price"}


def calibration_profile() -> CalibrationProfile | None:
    path = os.getenv("VALUATION_CALIBRATION_FILE")
    if not path:
        return None
    profile = CalibrationProfile.model_validate_json(Path(path).read_text())
    if profile.target != "sale":
        raise ValueError("opening market valuations require sale-basis calibration")
    return profile


def preview(data: dict) -> dict:
    obs = Observables(**{k: v for k, v in data.items() if k in Observables.__dataclass_fields__})
    profile = calibration_profile()
    benchmark = CATALOG.get(obs.category)
    benchmark_version = benchmark["version"] if benchmark else "legacy-priors-2026-09-11"
    if profile and profile.benchmark_version != benchmark_version:
        raise ValueError("Calibration benchmark version does not match the active pricing benchmark")
    val = value(obs, calibration={k: v.model_dump() for k, v in profile.estimators.items()} if profile else None, benchmark=benchmark)
    return {"v0": val.v0, "sigma": val.sigma, "low": val.low, "high": val.high, "method": val.method,
            "disagreement": val.disagreement,
            "estimates": [{"name": e.name, "value": e.value, "sigma": e.sigma, "note": e.note} for e in val.estimates],
            "as_of": iso(time.time()), "version": VERSION, "calibration_version": profile.version if profile else None,
            "benchmark_version": benchmark_version, "basis": "business-sale-estimate",
            "benchmark_status": "historical-sold" if benchmark else "provisional", "benchmark": benchmark,
            "opening_price": round(val.v0 / SHARES, 2),
            "warnings": ([] if profile else ["Uncalibrated uncertainty and quality adjustments"]) + ([] if benchmark else ["Provisional category benchmarks"])}


def norm(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.casefold()))


def verified_company(extracted: ExtractedCompany, pages: list[dict]) -> dict:
    by_url = {p["url"]: p["content"] for p in pages}
    # A returned schema is not proof that the company exists.
    if not any(norm(extracted.name) in norm(text) for text in by_url.values()):
        raise ValueError("Company name lacks supporting page text")
    data = extracted.model_dump(exclude={"evidence"})
    data["state"] = data["state"].upper() if data.get("state") else None
    data["sources"], evidence = [], []
    for fact in extracted.evidence:
        source = by_url.get(fact.source_url)
        if not source or not fact.quote.strip() or norm(fact.quote) not in norm(source):
            continue
        entry = fact.model_dump()
        entry["fetched_at"] = iso(time.time())
        # Inferred values are preserved as evidence but cannot silently become financial facts.
        if fact.status == "reported" and fact.field in Observables.__dataclass_fields__ and fact.field not in {"category", "state", "sources", "llm_estimate", "llm2_estimate", "llm_confidence"}:
            if fact.field in FINANCIAL:
                if fact.currency != "USD" or not fact.period:
                    continue
                if not isinstance(fact.value, (float, int)) or isinstance(fact.value, bool):
                    continue
                numbers = re.findall(r"\d[\d,]*(?:\.\d+)?", fact.quote)
                if not any(float(n.replace(",", "")) * scale == fact.value for n in numbers for scale in (1, 1000 if re.search(r"\b(thousand|k)\b|\d[kK]\b", fact.quote) else 1, 1000000 if re.search(r"million|\d[mM]\b", fact.quote) else 1)):
                    continue
            # Validate one input at a time; malformed evidence cannot poison an entire job.
            try:
                Observables(**{fact.field: fact.value})
            except (ValueError, TypeError):
                continue
            if fact.field not in data:
                data[fact.field] = fact.value
        evidence.append(entry)
        data["sources"].append(fact.source_url)
    data["sources"] = sorted(set(data["sources"]))
    data["evidence"] = evidence
    return data


def company_id(data: dict, existing: list[dict]) -> str:
    name, city, state = (norm(str(data.get(k) or "")) for k in ("name", "city", "state"))
    for c in existing:
        if (name, city, state) == tuple(norm(str(c.get(k) or "")) for k in ("name", "city", "state")):
            if not (data.get("address") and c.get("address")) or norm(data["address"]) == norm(c["address"]):
                return c["id"]
        # Match domains only with location; chains can share a website.
        if data.get("website") and c.get("website") and data.get("address") and c.get("address"):
            if urlsplit(data["website"]).netloc == urlsplit(c["website"]).netloc and norm(data["address"]) == norm(c["address"]):
                return c["id"]
    key = "|".join((name, city, state, norm(data.get("address") or "")))
    return "co_" + hashlib.sha256(key.encode()).hexdigest()[:16]


def save_company(engine, data: dict) -> dict:
    """No await between read and write: safe alongside this app's single-worker scheduler."""
    cid = company_id(data, engine.store.list_companies())
    previous = engine.store.get_company(cid)
    prior_evidence = previous.get("evidence", []) if previous else []
    combined = {json.dumps({k: v for k, v in e.items() if k != "fetched_at"}, sort_keys=True): e
                for e in [*prior_evidence, *data.get("evidence", [])]}
    data = {**data, "evidence": list(combined.values())}
    data["sources"] = sorted(set((previous.get("observables", {}).get("sources", []) if previous else []) + data.get("sources", [])))
    merged = {**(previous.get("observables", {}) if previous else {}), **{k: v for k, v in data.items() if v is not None}}
    snapshot = preview(merged)
    evidence = data.get("evidence", [])
    fingerprint = hashlib.sha256(json.dumps({"inputs": {k: v for k, v in merged.items() if k not in ("evidence", "source_documents")},
        "evidence": sorted(combined), "version": VERSION, "benchmark": snapshot["benchmark_version"],
        "calibration": snapshot["calibration_version"]}, sort_keys=True, default=str).encode()).hexdigest()
    if previous and previous.get("valuation_fingerprint") == fingerprint:
        return previous
    if previous:
        company = deepcopy(previous)
        company.update({k: v for k, v in data.items() if v is not None and k not in ("id", "valuation", "evidence")})
        company["observables"] = {k: v for k, v in merged.items() if k in Observables.__dataclass_fields__}
    else:
        company = engine.create_company({**merged, "id": cid})
    company["valuation"] = snapshot
    company["evidence"] = evidence
    company["source_documents"] = data.get("source_documents", previous.get("source_documents", []) if previous else [])
    company["valuation_fingerprint"] = fingerprint
    history = company.get("valuation_history", [])
    company["valuation_history"] = [*history[-19:], {**snapshot, "input_hash": fingerprint, "inputs": {k: v for k, v in merged.items() if k in Observables.__dataclass_fields__}, "evidence": evidence}]
    engine.store.put_company(company)
    market = engine.store.get_market(cid)
    if market:
        market["prior"] = {"mu": math.log(snapshot["v0"]), "sigma": snapshot["sigma"]}
        # Active markets adopt the new fundamental prior on the next real batch.
        # Never reset orders, positions, treasury inventory, or a traded price.
        if not market["belief"]["n_rounds"]:
            market["belief"].update(market["prior"])
            market["ref_price"] = snapshot["opening_price"]
            engine._requote(market)
        engine.store.put_market(market)
    engine.store.audit({"t": time.time(), "actor": "discovery", "action": "valuation_snapshot", "payload": {"id": cid, "input_hash": fingerprint}})
    return company
