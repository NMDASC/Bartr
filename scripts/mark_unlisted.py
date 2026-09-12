"""One time: companies discovered by the pipeline before the listing rule existed have open markets.
Mark everything that is not a seed as discovered (listed=False) in the configured store.

    cd apps/api && .venv/bin/python ../../scripts/mark_unlisted.py
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "api"))
os.environ["SEED"] = "0"; os.environ["BOTS"] = "0"
from app.deps import store

seed_ids = {c["id"] for c in json.load(open(os.path.join(os.path.dirname(__file__), "..", "apps", "api", "seeds", "companies.json")))}
n = 0
for c in store.list_companies():
    if c["id"] in seed_ids or c.get("listed") is False:
        continue
    m = store.get_market(c["id"])
    if m and m["belief"]["n_rounds"] > 0:
        continue   # someone already traded it; leave it listed
    c["listed"] = False
    store.put_company(c)
    if m:
        m["listed"] = False
        store.put_market(m)
    n += 1
print(f"marked {n} companies as discovered (not listed) in {type(store).__name__}")
