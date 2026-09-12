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
    parser.add_argument("--verify-sources", action="store_true", help="Fetch each result's profile to check source links")
    args = parser.parse_args()
    base = args.api.rstrip("/")

    def get(path):
        with urlopen(base + path, timeout=20) as response:
            return json.load(response)

    readiness = get("/readiness")
    live_sources = [name for name, field in [("Google Places", "google_places"), ("Querit", "querit"), ("Grok", "llm_xai")] if readiness.get(field)]
    if not live_sources:
        parser.exit(1, "Configure Google Places, Querit, or Grok on the API and restart it before warming cities.\n")
    print("Live sources:", ", ".join(live_sources), flush=True)
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
        available = -1
        with urlopen(base + "/api/v1/discovery/jobs/" + job["job_id"], timeout=210) as response:
            for line in response:
                if not line.startswith(b"data: "):
                    continue
                event = json.loads(line[6:])
                if event["type"] == "ranking":
                    companies = event["companies"]
                    if len(companies) != available:
                        available = len(companies)
                        print(json.dumps({"city": city, "matches_available": available}), flush=True)
                if event["type"] == "done":
                    terminal = event
                    break
        sourced = None
        if args.verify_sources:
            sourced = 0
            for company in companies:
                detail = get("/api/v1/companies/" + company["_id"])
                sourced += bool(detail.get("sources"))
        print(json.dumps({"city": city, "companies": len(companies), "with_sources": sourced,
            "status": terminal.get("status") if terminal else "interrupted",
            "warnings": terminal.get("warnings", []) if terminal else []}), flush=True)
        # Partial means at least one optional enrichment source failed. It is a
        # useful search result when sourced companies still reached the UI.
        failed |= terminal is None or terminal.get("status") == "failed" or not companies
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
