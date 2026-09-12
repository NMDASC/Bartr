import os
os.environ["SEED"] = "1"
from fastapi.testclient import TestClient
from app.main import app

H = {"X-Demo-User": "judge1"}


def test_end_to_end():
    with TestClient(app) as c:
        assert c.get("/health").json()["companies"] >= 8
        cards = c.get("/api/v1/companies?state=OK").json()
        assert all(x["state"] == "OK" for x in cards) and len(cards) >= 5
        assert cards[0]["_id"] and "v0_per_share" in cards[0] and "confidence" in cards[0]
        cid = "co_sudsy_tulsa"
        co = c.get(f"/api/v1/companies/{cid}").json()
        assert co["_id"] == cid and co["valuation"]["v0"] > 400000 and len(co["valuation"]["estimates"]) >= 3
        assert co["market"]["treasury"]["unsold_float"] == 3000 and co["financials"]["method"] == "extracted"
        assert co["created_at"].endswith("Z")
        book = c.get(f"/api/v1/markets/{cid}/book").json()
        assert book["asks"][0]["origin"] == "treasury" and "band" in book
        ask = book["asks"][0]["price"]
        r = c.post(f"/api/v1/markets/{cid}/orders", json={"side": "buy", "qty": 5, "limit_price": ask}, headers=H)
        assert r.status_code == 201, r.text
        assert r.json()["_id"].startswith("ord_") and r.json()["status"] == "open"
        r = c.post(f"/api/v1/markets/{cid}/orders", json={"side": "buy", "qty": 5, "limit_price": ask})
        assert r.status_code == 401
        b = c.post(f"/api/v1/markets/{cid}/batch/run").json()
        assert b["volume"] == 5 and b["clearing_price"] == ask and "imbalance" in b and b["t"].endswith("Z")
        p = c.get("/api/v1/portfolio", headers=H).json()
        assert p["positions"][0]["qty"] == 5 and p["pnl"]["total"] == 0
        s = c.post("/api/v1/portfolio/suggest", json={"states": ["OK"]}, headers=H).json()
        assert isinstance(s, list)
        s2 = c.post("/api/v1/portfolio/suggest", json={"own_values": {"co_okc_suds": 80}}, headers=H).json()
        assert s2 and s2[0]["company"]["_id"] == "co_okc_suds" and s2[0]["suggested_usd"] > 0
        # discovery: intent + SSE stream of seeded companies
        j = c.post("/api/v1/discovery/search", json={"q": "laundromat in Oklahoma under 600k"})
        assert j.status_code == 202 and j.json()["intent"] == {"category": "laundromat", "naics_guess": None, "state": "OK", "city": None, "min_value": None, "max_value": 600000.0, "must_have": []}
        with c.stream("GET", f"/api/v1/discovery/jobs/{j.json()['job_id']}") as r:
            evs = [line for line in r.iter_lines() if line.startswith("data:")]
        assert evs[0].startswith('data: {"type": "intent"') and evs[-1].startswith('data: {"type": "done"')
        assert sum(1 for e in evs if '"company_ready"' in e) >= 2
        # acquire
        a = c.post(f"/api/v1/acquire/{cid}/start", headers=H).json()
        assert a["loi_md"].startswith("# Letter of Intent") and any("Oklahoma" in i["item"] for i in a["checklist"])
        # flags endpoint exists and validates
        assert c.get("/api/v1/surveillance/flags").status_code == 200
        pv = c.post("/api/v1/companies/valuation/preview", json={"name": "x", "category": "car_wash", "employees": 9}).json()
        assert pv["sigma"] > 0.3
        assert c.get("/api/v1/surveillance/treasury").json()[0]["proceeds"] >= 0
        with c.websocket_connect(f"/ws/markets/{cid}") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "book"
