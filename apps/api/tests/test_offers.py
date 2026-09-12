import os
os.environ["SEED"] = "1"
from fastapi.testclient import TestClient
from app.main import app
from app.services.offers import compose

H = {"X-Demo-User": "buyer1"}


def test_discovered_company_shows_estimate_and_takes_offer_then_lists():
    with TestClient(app) as c:
        co = c.post("/api/v1/companies", json={"name": "Dormont Laundromat", "category": "laundromat", "state": "PA", "city": "Pittsburgh",
                                               "address": "3000 W Liberty Ave, Pittsburgh, PA 15216", "rating": 4.1, "review_count": 60, "listed": False}).json()
        cid = co["_id"]
        assert co["listed"] is False and co["market"]["listed"] is False
        card = next(x for x in c.get("/api/v1/companies?state=PA").json() if x["_id"] == cid)
        assert card["listed"] is False and card["bid"] is None and card["ask"] is None and card["v0_per_share"] > 0
        assert c.get(f"/api/v1/markets/{cid}/book").json()["asks"] == []
        r = c.post(f"/api/v1/markets/{cid}/orders", json={"side": "buy", "qty": 1, "limit_price": card["v0_per_share"]}, headers=H)
        assert r.status_code == 422 and "offer" in r.json()["detail"]
        o = c.post(f"/api/v1/companies/{cid}/offer", headers=H, json={"buyer_name": "Aditya Dewan", "buyer_email": "aditya@example.com", "buyer_phone": "412 555 0100",
                                                                       "message": "I grew up two streets over and would keep the staff on."}).json()
        assert o["status"] == "queued" and o["delivery"] == "queued" and o["price"] == round(co["valuation"]["v0"], 2)
        body = o["email"]["body"]
        assert body.startswith("To the owner of Dormont Laundromat,") and "Aditya Dewan" in body and "412 555 0100" in body
        assert "I grew up two streets over" in body and "reply with the word \"no\"" in body and "!" not in body
        assert o["email"]["subject"] == "An offer for Dormont Laundromat"
        assert c.get("/api/v1/offers/mine", headers=H).json()[0]["_id"] == o["_id"]
        # owner accepts: the business lists and quotes appear
        a = c.post(f"/api/v1/offers/{o['_id']}/accept").json()
        assert a["status"] == "accepted"
        assert c.get(f"/api/v1/companies/{cid}").json()["listed"] is True
        book = c.get(f"/api/v1/markets/{cid}/book").json()
        assert len(book["asks"]) == 5 and book["bids"][0]["origin"] == "treasury"
        assert c.post(f"/api/v1/companies/{cid}/offer", headers=H, json={"buyer_name": "X Y", "buyer_email": "x@y.com"}).status_code == 409


def test_offer_price_bounds_and_owner_greeting():
    with TestClient(app) as c:
        co = c.post("/api/v1/companies", json={"name": "Blvd Laundromat", "category": "laundromat", "state": "PA", "city": "Pittsburgh", "owners": ["Marie Kowalski"], "listed": False}).json()
        r = c.post(f"/api/v1/companies/{co['_id']}/offer", headers=H, json={"buyer_name": "A B", "buyer_email": "a@b.com", "price": 1})
        assert r.status_code == 422
        subject, body = compose(co | {"id": co["_id"]}, 300000, "A B", "a@b.com", None, None)
        assert body.startswith("Dear Marie Kowalski,") and "$300,000" in body and "reply to this email." in body


def test_search_emits_status_lines():
    with TestClient(app) as c:
        j = c.post("/api/v1/discovery/search", json={"q": "laundromat in pittsburgh", "live": False}).json()
        with c.stream("GET", f"/api/v1/discovery/jobs/{j['job_id']}") as r:
            lines = [l for l in r.iter_lines() if l.startswith("data:")]
        statuses = [l for l in lines if '"status"' in l and '"phase"' in l]
        assert any("already appraised" in l for l in statuses)
        assert any('"phase": "finished"' in l or '"phase":"finished"' in l for l in statuses)
