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
        cid = "co_sudsy_tulsa"
        co = c.get(f"/api/v1/companies/{cid}").json()
        assert co["valuation"]["v0"] > 400000 and len(co["valuation"]["estimates"]) >= 3
        book = c.get(f"/api/v1/markets/{cid}/book").json()
        ask = book["asks"][0]["price"]
        r = c.post(f"/api/v1/markets/{cid}/orders", json={"side": "buy", "qty": 5, "limit_price": ask}, headers=H)
        assert r.status_code == 201, r.text
        r = c.post(f"/api/v1/markets/{cid}/orders", json={"side": "buy", "qty": 5, "limit_price": ask})
        assert r.status_code == 401
        b = c.post(f"/api/v1/markets/{cid}/batch/run").json()
        assert b["volume"] == 5 and b["clearing_price"] == ask
        p = c.get("/api/v1/portfolio", headers=H).json()
        assert p["positions"][0]["qty"] == 5
        s = c.post("/api/v1/portfolio/suggest", json={"states": ["OK"]}, headers=H).json()
        assert isinstance(s, list)
        pv = c.post("/api/v1/companies/valuation/preview", json={"name": "x", "category": "car_wash", "employees": 9}).json()
        assert pv["sigma"] > 0.3
        assert c.get("/api/v1/surveillance/treasury").json()[0]["proceeds"] >= 0
        with c.websocket_connect(f"/api/v1/markets/ws/{cid}") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "book"
