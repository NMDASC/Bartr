"""Exercise every real Grok (and K2) call once. Needs XAI_API_KEY (and IFM_* for K2) in .env.

    cd apps/api && .venv/bin/python ../../scripts/grok_smoke.py

Prints one line per feature with latency and whether Grok or the fallback answered. Costs well under
a dollar at grok-4.6 prices. Run it the moment a key lands, before the demo.
"""
import asyncio, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "api"))
os.environ.setdefault("SEED", "1"); os.environ.setdefault("BOTS", "0")

from fastapi.testclient import TestClient
from app.main import app
from app.services.agents import grok

CID = "co_squirrel_hill_wash"
H = {"X-Demo-User": "smoke"}


def step(name, fn):
    t0 = time.time()
    try:
        out = fn()
        print(f"  {name:<18} {time.time()-t0:6.1f}s  {out}")
    except Exception as e:  # noqa: BLE001
        print(f"  {name:<18} {time.time()-t0:6.1f}s  ERROR {e!r}")


with TestClient(app) as c:
    print("configured:", grok.status()["xai"], "k2:", grok.status()["ifm"])
    step("intent", lambda: c.post("/api/v1/discovery/search", json={"q": "cnc machine shop near pittsburgh under 2M"}).json()["intent"])
    step("appraise", lambda: (lambda co: f"v0 ${co['valuation']['v0']:,.0f} sigma {co['valuation']['sigma']:.2f} method {co['valuation']['method']}")(c.post(f"/api/v1/companies/{CID}/appraise").json()))
    step("ask_owner", lambda: c.post(f"/api/v1/companies/{CID}/ask", json={"question": "Why are you selling, and what does the lease look like?"}, headers=H).json())
    book = c.get(f"/api/v1/markets/{CID}/book").json()
    c.post(f"/api/v1/markets/{CID}/orders", json={"side": "buy", "qty": 8, "limit_price": book["asks"][0]["price"]}, headers=H)
    c.post(f"/api/v1/markets/{CID}/batch/run")
    step("narrative", lambda: c.get(f"/api/v1/markets/{CID}/narrative").json()["narrative"])
    step("profile", lambda: c.post("/api/v1/portfolio/profile/parse", json={"text": "CMU grad student with 20k, want passive income near campus, nothing in food"}, headers=H).json())
    step("suggest_why", lambda: [s["why"] for s in c.post("/api/v1/portfolio/suggest", json={"own_values": {"co_lawrenceville_laundry": 90}}, headers=H).json()[:2]])
    step("redteam", lambda: c.post("/api/v1/surveillance/redteam", json={"market_id": CID}, headers=H).json()["plan"])
    step("flags", lambda: [(f["rule"], f["severity"], [r["reviewer"] for r in f["reviews"]], f["disputed"]) for f in c.get("/api/v1/surveillance/flags").json()[:3]])
    step("report", lambda: c.get("/api/v1/surveillance/report").json()["memo"])
    step("acquire", lambda: (lambda a: (a["loi_md"].splitlines()[0], [i["item"] for i in a["checklist"][:3]]))(c.post(f"/api/v1/acquire/{CID}/start", headers=H).json()))
    step("chat", lambda: c.post("/api/v1/agent/chat", json={"session_id": "smoke", "message": "find me a laundromat in pittsburgh and show me the book on the best one"}, headers=H).json()["content"])
    print("\nrecent calls:")
    for r in grok.status()["recent_calls"]:
        print(f"  {r['name']:<22} {r['provider']:<16} ok={r['ok']} {r['ms']}ms {r['note']}")
