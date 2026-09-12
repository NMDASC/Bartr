"""Run the Grok appraiser (web_search + structured, K2 second opinion if configured) once per seed
company and cache the result in apps/api/seeds/appraisals.json. The seed loader merges it at boot,
so every company page shows a real Grok appraisal instantly instead of waiting 60 to 120 seconds.

    cd apps/api && .venv/bin/python ../../scripts/appraise_seeds.py            # seeds -> seeds/appraisals.json, skips cached
    cd apps/api && .venv/bin/python ../../scripts/appraise_seeds.py --force    # redo everything
    cd apps/api && .venv/bin/python ../../scripts/appraise_seeds.py --store    # every company in the configured store
                                                                               # (Atlas via .env) lacking an appraisal;
                                                                               # writes the appraisal and revalued
                                                                               # posterior back to the store
"""
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "api"))
STORE_MODE = "--store" in sys.argv
if not STORE_MODE:
    os.environ["MONGODB_URI"] = ""
os.environ["SEED"] = "0"; os.environ["BOTS"] = "0"

from app.deps import engine, store
from app.services.agents import appraiser, grok
from app.services.discovery.valuation import Observables, value as run_valuation

SEEDS = os.path.join(os.path.dirname(__file__), "..", "apps", "api", "seeds", "companies.json")
OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "api", "seeds", "appraisals.json")


async def appraise_store(force: bool):
    """Appraise companies already in the store (Atlas when .env points there). Persists to the store."""
    import math
    cs = [c for c in store.list_companies() if force or not c.get("appraisal")]
    print(f"{len(cs)} companies to appraise in the {type(store).__name__}")
    fields = [k for k in Observables.__dataclass_fields__.keys() if k != "sources"]
    for c in cs:
        t0 = time.time()
        res = await appraiser.appraise(c)
        if res is None:
            print(f"  FAILED   {c['name']}"); continue
        obs = {**c["observables"], **res["patch"]}
        obs["sources"] = sorted(set(obs.get("sources", [])) | set(res["appraisal"].get("sources", [])))
        v = run_valuation(Observables(**{k: obs.get(k) for k in fields}, sources=obs["sources"]))
        c["observables"], c["valuation"] = obs, engine._val_dict(v)
        c["appraisal"] = {**res["appraisal"], "k2": res["k2"], "clamped": res["clamped"], "at": time.time()}
        if res["appraisal"].get("owners") and not c.get("owners"):
            c["owners"] = res["appraisal"]["owners"]
        store.put_company(c)
        m = store.get_market(c["id"])
        if m and m["belief"]["n_rounds"] == 0:
            m["prior"] = {"mu": math.log(v.v0), "sigma": v.sigma}
            m["belief"].update(mu=math.log(v.v0), sigma=v.sigma)
            m["ref_price"] = round(v.v0 / 10_000, 2)
            engine._requote(m); store.put_market(m)
        a = res["appraisal"]
        print(f"  {time.time()-t0:5.0f}s  {c['name'][:34]:<34} Grok ${a['value_usd']:>12,.0f} conf {a['confidence']:.2f} src {len(a['sources'])}  -> v0 ${v.v0:,.0f} sigma {v.sigma:.2f}")


async def main(force: bool):
    if not grok.configured("xai"):
        print("XAI_API_KEY not set"); return
    if STORE_MODE:
        await appraise_store(force); return
    seeds = json.load(open(SEEDS))
    cache = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for s in seeds:
        if s["id"] in cache and not force:
            print(f"  cached   {s['name']}"); continue
        c = engine.create_company(dict(s))
        t0 = time.time()
        res = await appraiser.appraise(c)
        if res is None:
            print(f"  FAILED   {s['name']}"); continue
        cache[s["id"]] = {"patch": res["patch"], "appraisal": res["appraisal"], "k2": res["k2"], "clamped": res["clamped"], "at": time.time()}
        json.dump(cache, open(OUT, "w"), indent=1)
        a = res["appraisal"]
        print(f"  {time.time()-t0:5.0f}s  {s['name']:<34} Grok ${a['value_usd']:>12,.0f} conf {a['confidence']:.2f}  sources {len(a['sources'])}  {'K2 $' + format(res['k2']['value_usd'], ',.0f') if res['k2'] else ''}")
        print(f"          {a['reasoning'][:160]}")

asyncio.run(main("--force" in sys.argv))
