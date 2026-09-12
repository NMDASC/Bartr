#!/usr/bin/env python3
"""Warm discovery through the same API used by the UI, Pittsburgh first.

python3 scripts/discover_cities.py
python3 scripts/discover_cities.py --city 'Austin, TX' --category 'car wash'
"""
from __future__ import annotations

import argparse
import json
from urllib.request import Request, urlopen

DEFAULT_CITIES = ["Pittsburgh, PA", "New York City, NY", "Miami, FL", "Chicago, IL", "San Francisco, CA"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://127.0.0.1:8000")
    parser.add_argument("--city", action="append", help="Repeat to search multiple cities")
    parser.add_argument("--category", default="laundromat")
    parser.add_argument("--limit", type=int, default=12, choices=range(1, 51), metavar="1..50")
    args = parser.parse_args()
    base = args.api.rstrip("/")

    def get(path):
        with urlopen(base + path, timeout=20) as response:
            return json.load(response)

    readiness = get("/readiness")
    if not readiness.get("querit") or not readiness.get("llm_xai"):
        missing = [name for name, field in [("Querit", "querit"), ("Grok", "llm_xai")] if not readiness.get(field)]
        parser.exit(1, f"Configure {' and '.join(missing)} on the API and restart it before warming cities.\n")
    failed = False
    for city in args.city or DEFAULT_CITIES:
        query = f"{args.category} in {city}"
        print(f"Searching {query}...", flush=True)
        request = Request(base + "/api/v1/discovery/search", method="POST",
            data=json.dumps({"q": query, "live": True, "limit": args.limit}).encode(),
            headers={"Content-Type": "application/json"})
        with urlopen(request, timeout=30) as response:
            job = json.load(response)
        companies, terminal = [], None
        with urlopen(base + "/api/v1/discovery/jobs/" + job["job_id"], timeout=210) as response:
            for line in response:
                if not line.startswith(b"data: "):
                    continue
                event = json.loads(line[6:])
                if event["type"] == "ranking":
                    companies = event["companies"]
                if event["type"] == "done":
                    terminal = event
                    break
        sourced = 0
        for company in companies:
            detail = get("/api/v1/companies/" + company["_id"])
            sourced += bool(detail.get("sources"))
        print(json.dumps({"city": city, "companies": len(companies), "with_sources": sourced,
            "status": terminal.get("status") if terminal else "interrupted",
            "warnings": terminal.get("warnings", []) if terminal else []}), flush=True)
        failed |= terminal is None or terminal.get("status") != "done"
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
