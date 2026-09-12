"""Research the acquisition checklist (Grok web_search, cited) once per distinct (city, state, category)
among the seed companies and cache it in apps/api/seeds/checklists.json for instant demo loads.

    cd apps/api && .venv/bin/python ../../scripts/warm_checklists.py
"""
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "api"))
os.environ["MONGODB_URI"] = ""; os.environ["SEED"] = "0"
from app.env import load_env; load_env()
from app.services.agents import acquire_agent, grok

SEEDS = os.path.join(os.path.dirname(__file__), "..", "apps", "api", "seeds", "companies.json")
OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "api", "seeds", "checklists.json")


async def main():
    if not grok.configured("xai"):
        print("XAI_API_KEY not set"); return
    cache = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for c in json.load(open(SEEDS)):
        k = f"{c.get('city')}|{c.get('state')}|{c['category']}"
        if k in cache:
            print(f"  cached  {k}"); continue
        t0 = time.time()
        items = await acquire_agent.checklist(c)
        if items:
            cache[k] = items
            json.dump(cache, open(OUT, "w"), indent=1)
            print(f"  {time.time()-t0:4.0f}s  {k}: {len(items)} items, {sum(1 for i in items if i['citation'])} cited")
        else:
            print(f"  FAILED  {k}")

asyncio.run(main())
