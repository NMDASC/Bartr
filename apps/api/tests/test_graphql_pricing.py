import copy
import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.graphql import schema
from app.services.discovery import jobs
from app.services.discovery.intent import parse_intent
from app.services.discovery.models import DiscoveryRequest, ExtractedCompany
from app.services.discovery.pricing import preview, save_company, verified_company, company_id
from app.services.discovery.valuation import Observables, fit_calibration, value
from app.services.market.engine import Engine
from app.store import MemoryStore
from calibrate_pricing import build_profile


def fixture_extraction():
    pages = [{"url": "https://example.com/listing", "title": "Laundry", "content":
        "Pittsburgh Main Laundry at 1 Main Street. Annual 2025 SDE is $100,000 USD."}]
    company = ExtractedCompany(name="Pittsburgh Main Laundry", category="laundromat", city="Pittsburgh", state="PA",
        address="1 Main Street", website="https://example.com", phone=None, description="Local laundromat",
        evidence=[{"field": "sde", "value": 100000, "source_url": pages[0]["url"], "quote": "Annual 2025 SDE is $100,000 USD.", "status": "reported", "currency": "USD", "period": "2025"}])
    return company, pages


def test_evidence_requires_real_source_quote_and_correct_amount():
    c, pages = fixture_extraction()
    assert verified_company(c, pages)["sde"] == 100000
    c.evidence[0].value = 900000.0
    assert "sde" not in verified_company(c, pages)
    c.evidence[0].value = 100000.0
    c.evidence[0].source_url = "https://invented.example/"
    assert "sde" not in verified_company(c, pages)
    c.name = "Invented Laundry"
    with pytest.raises(ValueError): verified_company(c, pages)


def test_refresh_preserves_market_orders_positions_and_deduplicates():
    e = Engine(MemoryStore())
    c, pages = fixture_extraction()
    data = verified_company(c, pages)
    company = save_company(e, data)
    cid = company["id"]
    ask = e.book(cid)["asks"][0]["price"]
    e.place_order("nico", cid, "buy", 2, ask)
    e.run_batch(cid)
    market = copy.deepcopy(e.store.get_market(cid))
    user = copy.deepcopy(e.store.get_user("nico"))
    e.place_order("nico", cid, "buy", 1, ask)
    outstanding = copy.deepcopy(e.store.open_orders(cid))
    refreshed = save_company(e, {**data, "sde": 130000})
    assert len(e.store.list_companies()) == 1
    assert e.store.get_user("nico") == user
    assert e.store.open_orders(cid) == outstanding
    assert e.store.get_market(cid)["treasury"] == market["treasury"]
    assert e.store.get_market(cid)["last_price"] == market["last_price"]
    count = len(refreshed["valuation_history"])
    assert len(save_company(e, {**data, "sde": 130000})["valuation_history"]) == count
    assert refreshed["valuation"]["benchmark_status"] == "historical-sold"


def test_same_chain_in_same_city_different_address_is_distinct():
    existing = [{"id": "one", "name": "Laundry", "city": "Pittsburgh", "state": "PA", "address": "1 Main St"}]
    assert company_id({**existing[0], "address": "2 Main St"}, existing) != "one"


def test_identical_first_refresh_has_one_snapshot_and_preserves_sources():
    e = Engine(MemoryStore())
    c, pages = fixture_extraction()
    data = verified_company(c, pages)
    data["source_documents"] = [{"url": pages[0]["url"], "title": "Original", "snippet": "", "fetched_at": "2026-09-12T00:00:00Z"}]
    first = save_company(e, data)
    same = save_company(e, data)
    assert len(same["valuation_history"]) == 1
    assert same["valuation"]["as_of"] == first["valuation"]["as_of"]
    new_doc = {"url": "https://example.com/about", "title": "Updated", "snippet": "", "fetched_at": "2026-09-12T00:00:00Z"}
    updated = save_company(e, {**data, "description": "Updated description", "source_documents": [new_doc]})
    assert len(updated["source_documents"]) == 2
    assert len(updated["valuation_history"]) == 1
    assert updated["description"] == "Updated description"


@pytest.mark.parametrize("quote,amount", [
    ("Annual 2025 SDE is -$100,000 USD.", 100000),
    ("Annual 2025 SDE is $100,000 USD and revenue is $1 million USD.", 100000000000),
    ("2025 SDE is $10,000 USD monthly.", 10000),
    ("Annual 2025 revenue is $100,000 USD.", 100000),
    ("Annual 2025 SDE is $100,000 CAD.", 100000),
    ("Annual 2024 SDE is $100,000 USD.", 100000),
])
def test_unsupported_financial_evidence_is_not_priced(quote, amount):
    c, pages = fixture_extraction()
    c.evidence[0].quote, c.evidence[0].value = quote, float(amount)
    pages[0]["content"] = c.name + ". " + quote
    assert "sde" not in verified_company(c, pages)


@pytest.mark.parametrize("args", [{"sde": -1}, {"revenue": float("inf")}, {"rating": 6}, {"employees": -2}, {"llm_confidence": 2}, {"sde": True}, {"rating": "five"}, {"owner_operated": "false"}])
def test_invalid_valuation_inputs(args):
    with pytest.raises(ValueError): preview(args)


def test_calibration_corrects_bias_and_blinds_labels():
    cases = []
    for sde in (50000, 100000, 150000):
        obs = Observables(category="hvac", sde=sde, asking_price=99999999, llm_estimate=99999999)
        estimate = next(e for e in value(obs).estimates if e.name == "income")
        cases.append((obs, estimate.value / 2))
    profile = fit_calibration(cases, version="test-training")
    assert profile["estimators"]["income"]["bias"] == pytest.approx(math.log(2))
    assert "listing" not in profile["estimators"] and "llm" not in profile["estimators"]
    assert profile["estimators"]["income"]["sigma"] >= .12
    corrected = value(Observables(category="hvac", sde=100000), calibration=profile["estimators"])
    income = next(e for e in corrected.estimates if e.name == "income")
    assert income.value == pytest.approx(cases[1][1])


def test_calibration_cli_blinds_labels_and_rejects_duplicate_businesses():
    rows = [{"company_id": str(i), "split": "test" if i == 3 else "train", "sale_price": 300000,
             "observables": {"category": "laundromat", "sde": 100000, "asking_price": 99999999}}
            for i in range(4)]
    profile = build_profile(rows, "training-v1")
    assert profile["category"] == "laundromat"
    assert profile["estimators"]["income"]["count"] == 3
    assert profile["evaluation"]["calibrated"]["count"] == 1
    assert "listing" not in profile["estimators"]
    rows[-1]["company_id"] = "0"
    with pytest.raises(ValueError, match="unique"): build_profile(rows, "bad")


def test_category_calibration_does_not_leak_into_other_categories(monkeypatch):
    from app.services.discovery.models import CalibrationProfile
    profile = CalibrationProfile(version="hvac-v1", target="sale", category="hvac", estimators={})
    monkeypatch.setattr("app.services.discovery.pricing.calibration_profile", lambda: profile)
    assert preview({"category": "hvac"})["calibration_version"] == "hvac-v1"
    other = preview({"category": "auto_repair"})
    assert other["calibration_version"] is None
    assert any("does not cover" in w for w in other["warnings"])


@pytest.mark.asyncio
async def test_graphql_jobs_rank_constraints_and_pagination(monkeypatch):
    e = Engine(MemoryStore())
    for name, city, state in [("Main Laundry", "Pittsburgh", "PA"), ("Other Laundry", "Pittsburgh", "PA"), ("Tulsa Laundry", "Tulsa", "OK")]:
        e.create_company({"name": name, "city": city, "state": state, "category": "laundromat", "sde": 100000})
    manager = jobs.DiscoveryJobs(e)
    monkeypatch.setattr(jobs, "service", lambda: manager)
    monkeypatch.setattr("app.routers.graphql.service", lambda: manager)
    result = await schema.execute('mutation { startDiscovery(input:{q:"laundromat in Pittsburgh", live:false}) { id } }')
    assert result.errors is None
    jid = result.data["startDiscovery"]["id"]
    job = manager.get(jid)
    assert manager.start(job.request) is job
    await job.task
    query = 'query($id: ID!) { searchResults(jobId:$id, first:1) { total endCursor hits { company { id city } relevance { rank score } } } }'
    result = await schema.execute(query, variable_values={"id": jid})
    assert result.errors is None
    page = result.data["searchResults"]
    assert page["total"] == 2 and page["hits"][0]["company"]["city"] == "Pittsburgh"
    second = manager.page(jid, first=1, after=page["endCursor"])
    assert second["hits"][0]["company"]["_id"] != page["hits"][0]["company"]["id"]
    for invalid in ("bad", "W10="):
        with pytest.raises(ValueError): manager.page(jid, after=invalid)
    with pytest.raises(ValueError): manager.page(jid, first=100)
    before = [ev async for ev in manager.events(job)]
    assert before == [ev async for ev in manager.events(job)]
    empty = manager.start(DiscoveryRequest(q="laundromat in Pittsburgh under 1", live=False))
    await empty.task
    assert not empty.results
    detail = await schema.execute('query($id: ID!) { company(id:$id) { name valuation { v0 benchmarkVersion basis } sources { url } evidence { field } valuationHistory { version } } }', variable_values={"id": page["hits"][0]["company"]["id"]})
    assert detail.errors is None
    assert detail.data["company"]["valuation"]["v0"] > 0
    await manager.close()


def test_graphql_endpoint_preview_and_validation(monkeypatch):
    monkeypatch.setenv("DISCOVERY_LIVE", "0")
    with TestClient(app) as client:
        data = client.post("/graphql", json={"query": '{ previewValuation(input:{category:"laundromat", sde:100000}) { v0 low high openingPrice benchmarkStatus } }'}).json()
        assert "errors" not in data, data
        val = data["data"]["previewValuation"]
        assert val["low"] < val["v0"] < val["high"] and val["benchmarkStatus"] == "historical-sold"
        assert client.post("/api/v1/companies/valuation/preview", json={"name":"bad", "sde":-1}).status_code == 422
