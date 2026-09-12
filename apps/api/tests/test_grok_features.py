"""Grok features with a fake model: verifies the wiring, the fallbacks, and the shapes.
No network. Real calls are exercised by scripts/grok_smoke.py when XAI_API_KEY is set."""
import json
import os

import pytest
from fastapi.testclient import TestClient

os.environ["SEED"] = "1"
from app.main import app
from app.services.agents import grok, compliance, redteam
from app.services.agents.appraiser import Appraisal, Opinion
from app.services.agents.compliance import ReviewOpinion as Review
from app.services.agents.intent import Intent
from app.services.agents.persona import Answer
from app.services.agents.portfolio_agent import RiskProfile, Whys
from app.services.agents.redteam import AttackPlan
from app.services.agents.acquire_agent import Checklist, Item, Citation

H = {"X-Demo-User": "judge9"}
CID = "co_squirrel_hill_wash"


class FakeGrok:
    """Monkeypatched in place of grok.structured / text / researched / second_opinion."""
    def __init__(self):
        self.calls = []

    async def structured(self, name, schema, system, user, **kw):
        self.calls.append(name)
        if schema is Appraisal:
            return Appraisal(value_usd=610_000, confidence=0.8, revenue_est=None, sde_est=None, owners=["Rita Kalinowski"],
                             reasoning="Listing and reviews support a premium laundromat multiple.", sources=["https://example.com/listing"])
        if schema is Opinion:
            return Opinion(value_usd=540_000, confidence=0.6, reasoning="K2 view.")
        if schema is Intent:
            return Intent(category="machine_shop", state="PA", city="Pittsburgh", max_value=2_000_000, must_have=["CNC"])
        if schema is Review:
            return Review(severity="high", explanation="Pair trades only with each other. Freeze both accounts.")
        if schema is RiskProfile:
            return RiskProfile(tolerance=0.3, horizon="long", sectors=["laundromat", "daycare"], states=["PA"], budget=20000, summary="Passive income near campus")
        if schema is Whys:
            n = user.count("'name':")
            return Whys(reasons=[f"reason {i}" for i in range(max(n, 8))])
        if schema is Answer:
            return Answer(answer="We have been on Murray Avenue since 2011.", grounded=True, used=["years_operating"])
        if schema is AttackPlan:
            return AttackPlan(attack="spoof", rounds=2, size=30, offset_pct=6, rationale="Layer bids below to lure sellers, then sell into them.")
        if schema is Checklist:
            return Checklist(items=[Item(item=f"Item {i}", why="because", citation=Citation(url="https://pittsburghpa.gov", title="City")) for i in range(5)])
        return None

    async def text(self, name, system, user, **kw):
        self.calls.append(name)
        if name == "loi":
            return "# Non-Binding Letter of Intent\n\n**Buyer:** judge9\n\n## 1. Proposed consideration\n$570,800."
        return f"{name}: two lines of commentary."

    async def researched(self, name, question, **kw):
        self.calls.append(name)
        return "Notes: BizBuySell listing at https://example.com/listing says SDE 152k. City permits at https://pittsburghpa.gov."

    async def second_opinion(self, name, schema, system, user):
        return await self.structured(name + ":k2", schema, system, user)


@pytest.fixture
def fake(monkeypatch):
    f = FakeGrok()
    for mod in ("app.services.agents.appraiser", "app.services.agents.intent", "app.services.agents.narrator",
                "app.services.agents.portfolio_agent", "app.services.agents.persona", "app.services.agents.redteam",
                "app.services.agents.acquire_agent", "app.services.agents.health"):
        m = __import__(mod, fromlist=["grok"])
        monkeypatch.setattr(m.grok, "structured", f.structured)
        monkeypatch.setattr(m.grok, "text", f.text)
        monkeypatch.setattr(m.grok, "researched", f.researched)
        monkeypatch.setattr(m.grok, "second_opinion", f.second_opinion)
        monkeypatch.setattr(m.grok, "configured", lambda p="xai": True)
    compliance._CACHE.clear()
    # their compliance module calls llm.complete directly; fake it too
    async def fake_complete(messages, provider="xai", schema=None, **kw):
        return Review(severity="high" if provider == "xai" else "medium", explanation="Pair trades only with each other. Freeze both accounts.")
    monkeypatch.setattr(compliance, "complete", fake_complete)
    monkeypatch.setattr(compliance, "is_configured", lambda p: True)
    import app.routers.surveillance as surv
    import app.llm as llm_mod
    monkeypatch.setattr(llm_mod, "is_configured", lambda p: True)
    return f


def test_fallbacks_without_key():
    with TestClient(app) as c:
        assert c.post(f"/api/v1/companies/{CID}/appraise").status_code == 503
        a = c.post(f"/api/v1/companies/{CID}/ask", json={"question": "how long have you been open?"}, headers=H).json()
        assert a["reviewer"] == "fallback" and "14 years" in a["answer"]
        assert c.get(f"/api/v1/markets/{CID}/narrative").json()["narrative"] is None
        p = c.post("/api/v1/portfolio/profile/parse", json={"text": "cautious"}, headers=H).json()
        assert p["reviewer"] == "fallback"
        r = c.get("/api/v1/surveillance/report").json()
        assert r["reviewer"] == "rules" and "events in the last hour" in r["memo"]
        rt = c.post("/api/v1/surveillance/redteam", json={"market_id": CID}, headers=H).json()
        assert rt["planner"] == "fallback" and rt["plan"]["attack"] in ("wash", "spoof", "pump")


def test_appraise_feeds_ensemble_and_reanchors(fake):
    with TestClient(app) as c:
        before = c.get(f"/api/v1/companies/{CID}").json()
        co = c.post(f"/api/v1/companies/{CID}/appraise").json()
        names = [e["name"] for e in co["valuation"]["estimates"]]
        assert "llm" in names
        llm = next(e for e in co["valuation"]["estimates"] if e["name"] == "llm")
        assert 540_000 < llm["value"] < 610_000          # mean of Grok and K2 in log space
        assert "https://example.com/listing" in [s["url"] for s in co["sources"]]
        assert co["market"]["ref_price"] != before["market"]["ref_price"] or co["valuation"]["v0"] != before["valuation"]["v0"]
        assert {"appraise.research", "appraise", "appraise:k2"} <= set(fake.calls)


def test_intent_uses_grok(fake):
    with TestClient(app) as c:
        j = c.post("/api/v1/discovery/search", json={"q": "cnc machine shop near pittsburgh under 2M"}).json()
        assert j["intent"]["category"] == "machine_shop" and j["intent"]["must_have"] == ["CNC"]


def test_persona_narrative_profile_why(fake):
    with TestClient(app) as c:
        a = c.post(f"/api/v1/companies/{CID}/ask", json={"question": "how long?"}, headers=H).json()
        assert a["reviewer"] == "grok" and a["grounded"]
        book = c.get(f"/api/v1/markets/{CID}/book").json()
        c.post(f"/api/v1/markets/{CID}/orders", json={"side": "buy", "qty": 5, "limit_price": book["asks"][0]["price"]}, headers=H)
        c.post(f"/api/v1/markets/{CID}/batch/run")
        n = c.get(f"/api/v1/markets/{CID}/narrative").json()
        assert n["reviewer"] == "grok" and "commentary" in n["narrative"]
        p = c.post("/api/v1/portfolio/profile/parse", json={"text": "CMU grad student, 20k, passive income near campus"}, headers=H).json()
        assert p["states"] == ["PA"] and p["reviewer"] == "grok"
        s = c.post("/api/v1/portfolio/suggest", json={"own_values": {"co_lawrenceville_laundry": 90, "co_schenley_daycare": 120}}, headers=H).json()
        assert s and s[0]["why"].startswith("reason")


def test_compliance_reviews_and_dispute(fake):
    with TestClient(app) as c:
        # build a wash pair on the tape by trading two accounts only with each other
        book = c.get(f"/api/v1/markets/{CID}/book").json()
        ask = book["asks"][0]["price"]
        c.post(f"/api/v1/markets/{CID}/orders", json={"side": "buy", "qty": 20, "limit_price": ask}, headers={"X-Demo-User": "w1"})
        c.post(f"/api/v1/markets/{CID}/batch/run")
        for _ in range(2):
            last = c.get(f"/api/v1/markets/{CID}").json()["last_price"]
            c.post(f"/api/v1/markets/{CID}/orders", json={"side": "sell", "qty": 5, "limit_price": last}, headers={"X-Demo-User": "w1"})
            c.post(f"/api/v1/markets/{CID}/orders", json={"side": "buy", "qty": 5, "limit_price": last}, headers={"X-Demo-User": "w2"})
            c.post(f"/api/v1/markets/{CID}/batch/run")
            c.post(f"/api/v1/markets/{CID}/orders", json={"side": "sell", "qty": 5, "limit_price": last}, headers={"X-Demo-User": "w2"})
            c.post(f"/api/v1/markets/{CID}/orders", json={"side": "buy", "qty": 5, "limit_price": last}, headers={"X-Demo-User": "w1"})
            c.post(f"/api/v1/markets/{CID}/batch/run")
        fl = c.get(f"/api/v1/surveillance/flags?market_id={CID}").json()
        wash = [f for f in fl if f["rule"] == "wash_trading"]
        assert wash, fl
        f = wash[0]
        assert {r["reviewer"] for r in f["reviews"]} == {"rules", "grok", "k2"}
        assert f["disputed"] and f["reviewer"] == "grok" and "Freeze" in f["explanation"]


def test_redteam_spoof_is_caught(fake):
    with TestClient(app) as c:
        rt = c.post("/api/v1/surveillance/redteam", json={"market_id": CID}, headers=H).json()
        assert rt["planner"] == "grok" and rt["plan"]["attack"] == "spoof"
        assert len(rt["execution"]["orders"]) >= 3
        # fire the scheduled cancels (as the scheduler would just before the round) and clear
        for item in list(redteam._pending_cancels):
            redteam._pending_cancels.remove(item)
            c.delete(f"/api/v1/markets/orders/{item[2]}", headers={"X-Demo-User": item[1]})
        c.post(f"/api/v1/markets/{CID}/batch/run")
        # spoof_1 needs a fill on the other side for the rule; give it one by buying its half order
        c.post(f"/api/v1/markets/{CID}/batch/run")
        mine = c.get(f"/api/v1/markets/{CID}/orders/mine", headers={"X-Demo-User": "spoof_1"}).json()
        assert sum(1 for o in mine if o["status"] == "cancelled") >= 3
        # second attack round: spoof_1 now holds shares, layers bids again and sells into the book
        from app.deps import engine
        redteam.execute(engine, CID, AttackPlan(**rt["plan"]))
        for item in list(redteam._pending_cancels):
            redteam._pending_cancels.remove(item)
            engine.cancel_order(item[1], item[2])
        last = c.get(f"/api/v1/markets/{CID}").json()["last_price"]
        c.post(f"/api/v1/markets/{CID}/orders", json={"side": "buy", "qty": 30, "limit_price": last}, headers={"X-Demo-User": "victim"})
        c.post(f"/api/v1/markets/{CID}/batch/run")
        fl = c.get(f"/api/v1/surveillance/flags?market_id={CID}").json()
        spoof = [f for f in fl if f["rule"] == "spoofing"]
        assert spoof and spoof[0]["subjects"] == ["spoof_1"] and "grok" in {r["reviewer"] for r in spoof[0]["reviews"]}


def test_acquire_uses_grok_loi_and_cited_checklist(fake):
    with TestClient(app) as c:
        a = c.post(f"/api/v1/acquire/{CID}/start", headers=H).json()
        assert a["loi_md"].startswith("# Non-Binding Letter of Intent") and "judge9" in a["loi_md"]
        assert len(a["checklist"]) == 5 and a["checklist"][0]["citation"]["url"].startswith("https://pittsburghpa.gov")


def test_health_memo(fake):
    with TestClient(app) as c:
        r = c.get("/api/v1/surveillance/report").json()
        assert r["reviewer"] == "grok" and r["summary"]["markets"] >= 12
