import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.services.discovery.intent import parse_intent
from app.services.discovery.jobs import DiscoveryJobs
from app.services.discovery.models import DiscoveryRequest, ExtractedCompanies, ExtractedCompany, Evidence, ParsedIntent
from app.services.discovery.ranking import rank_companies
from app.services.discovery.querit import ContentsUnavailable, Querit
from app.services.market.engine import Engine
from app.store import MemoryStore


@pytest.mark.parametrize("query,city,state", [
    ("laundromat in Pittsburgh", "Pittsburgh", "PA"),
    ("laundromats in NYC", "New York", "NY"),
    ("car wash in New York City, NY", "New York", "NY"),
    ("laundromat near Miami under 700k", "Miami", "FL"),
    ("machine shop in Chicago", "Chicago", "IL"),
    ("restaurant in San Fransisco", "San Francisco", "CA"),
    ("laundromat in SF", "San Francisco", "CA"),
    ("car wash in Los Angeles", "Los Angeles", "CA"),
    ("laundromat near Seattle", "Seattle", "WA"),
    ("laundromat in Oakland, CA", "Oakland", "CA"),
    ("laundromat in Oakland, PA", "Pittsburgh", "PA"),
    ("restaurant in Portland, ME", "Portland", "ME"),
    ("restaurant in Portland Oregon", "Portland", "OR"),
    ("laundromat in Homestead, FL", "Homestead", "FL"),
    ("laundromat in Washington DC", "Washington", "DC"),
    ("laundromat in Ann Arbor, MI under 1M", "Ann Arbor", "MI"),
    ("laundromat in New York state", None, "NY"),
    ("machine shop in West Virginia", None, "WV"),
    ("laundromat in Miami Gardens, FL", "Miami Gardens", "FL"),
    ("laundromat in Brooklyn, New York", "Brooklyn", "NY"),
])
def test_city_queries(query, city, state):
    intent = parse_intent(query)
    assert (intent["city"], intent["state"]) == (city, state)


def test_city_and_budget_never_relax():
    engine = Engine(MemoryStore())
    for city, state in [("Pittsburgh", "PA"), ("Miami", "FL"), ("Chicago", "IL"), ("San Francisco", "CA"), ("Brooklyn", "NY")]:
        engine.create_company({"name": f"Test {city} Laundry", "category": "laundromat", "city": city, "state": state})
    companies = engine.store.list_companies()
    for query, expected in [("laundromat in Pittsburgh", "Pittsburgh"), ("laundromat in NYC", "Brooklyn"), ("laundromat in SF", "San Francisco")]:
        rows = rank_companies(query, parse_intent(query), companies)
        assert len(rows) == 1 and rows[0][0]["city"] == expected
    for query in ("laundromat in Boston", "laundromat in Miami under $1"):
        assert rank_companies(query, parse_intent(query), companies) == []


def test_catalog_card_reuses_market_without_changing_prices():
    class CountingStore(MemoryStore):
        reads = 0
        def get_market(self, mid):
            self.reads += 1
            return super().get_market(mid)

    store = CountingStore()
    engine = Engine(store)
    company = engine.create_company({"name": "Catalog Laundry", "category": "laundromat"})
    expected = engine.card(company)
    market = store.list_markets()[0]
    store.reads = 0
    assert engine.card(company, market=market) == expected
    assert store.reads == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("contents_enabled", [True, False])
@pytest.mark.parametrize("city,state,alias", [
    ("Pittsburgh", "PA", "Pittsburgh"), ("New York", "NY", "NYC"),
    ("Miami", "FL", "Miami"), ("Chicago", "IL", "Chicago"),
    ("San Francisco", "CA", "San Fransisco"),
])
async def test_retrieval_to_ranked_company_and_source(monkeypatch, city, state, alias, contents_enabled):
    from app.services.discovery import jobs
    engine = Engine(MemoryStore())
    url = "https://example.org/laundry"
    name = f"Test {city} Laundry"
    quote = "Annual revenue for 2025 is $300,000."
    pages = [{"url": url, "title": name, "content": f"{name}, {city}, {state}. {quote}"}]
    extracted = ExtractedCompany(name=name, category="laundromat", city=city, state=state,
        address="123 Test Street", website=url, phone=None, description="Test fixture laundry",
        evidence=[Evidence(field="revenue", value=300000, source_url=url, quote=quote, currency="USD", period="2025")])

    class Provider:
        calls = 0
        async def search(self, query, count):
            self.calls += 1
            return pages
        async def contents(self, pages):
            if not contents_enabled:
                raise ContentsUnavailable("Full page retrieval is not enabled")
            return pages

    async def complete(messages, *, schema, **options):
        if schema is ParsedIntent:
            return ParsedIntent(**parse_intent(f"laundromat in {alias}"))
        # Include an out-of-city extraction to ensure it does not create a market.
        wrong = extracted.model_copy(update={"city": "Boston", "state": "MA"})
        return ExtractedCompanies(companies=[extracted, wrong])

    async def places(query, count):
        return []

    monkeypatch.setenv("QUERIT_API_KEY", "test-only")
    monkeypatch.setenv("DISCOVERY_LIVE", "1")
    monkeypatch.setattr(jobs.llm, "is_configured", lambda provider: True)
    monkeypatch.setattr(jobs.llm, "complete", complete)
    monkeypatch.setattr(jobs, "text_search", places)
    provider = Provider()
    manager = DiscoveryJobs(engine, provider)
    request = DiscoveryRequest(q=f"laundromat in {alias}")
    job = manager.start(request)
    await job.task
    assert job.status == ("done" if contents_enabled else "partial"), job.warnings
    if not contents_enabled:
        assert job.warnings == ["Full page retrieval is not enabled; search excerpts were used"]
    assert len(job.results) == 1
    assert len(engine.store.list_companies()) == len(engine.store.list_markets()) == 1
    card = job.results[0]["company"]
    assert card["city"] == city and card["state"] == state
    assert card["v0_per_share"] > 0
    detail = engine.company_out(engine.store.get_company(card["_id"]))
    assert detail["financials"]["revenue_est"] == 300000
    assert detail["evidence"][0]["quote"] == quote
    assert detail["sources"][0]["url"] == url
    count = provider.calls
    if contents_enabled:
        assert manager.start(request).id == job.id
    replay = [event async for _, event in manager.events(job)]
    assert replay[-1]["type"] == "done" and replay[-1]["total"] == 1
    assert provider.calls == count
    await manager.close()


@pytest.mark.asyncio
async def test_contents_subscription_denial_is_not_retried(monkeypatch):
    calls = []

    def respond(request):
        calls.append(request.url.path)
        return httpx.Response(403, json={"error_msg": "No active contents subscription"})

    monkeypatch.setenv("QUERIT_API_KEY", "test-only")
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = Querit(client)
        pages = [{"url": "https://example.org/laundry", "title": "Laundry", "content": "Excerpt"}]
        for _ in range(2):
            with pytest.raises(ContentsUnavailable):
                await provider.contents(pages)
        assert calls == ["/v1/contents"]


@pytest.mark.asyncio
async def test_places_results_survive_model_timeout_without_relaxing_city(monkeypatch):
    from app.services.discovery import jobs
    engine = Engine(MemoryStore())
    place = {"name": "NYC Test Laundry", "source_url": "https://maps.google.com/?cid=123",
             "city": "New York", "state": "NY", "country": "US", "category": None,
             "address": "123 Test Street, New York, NY", "rating": 4.5, "review_count": 20}

    class Provider:
        async def search(self, query, count):
            return []
        async def contents(self, pages):
            return pages

    async def places(query, count):
        return [place, {**place, "name": "Wrong City Laundry", "city": "Boston", "state": "MA", "source_url": "https://maps.google.com/?cid=124"},
                {**place, "name": "Unknown Location Laundry", "city": None, "source_url": "https://maps.google.com/?cid=125"}]

    async def timeout(*args, **kwargs):
        # Structured results must already be stored before the slow extraction.
        assert len(engine.store.list_companies()) == 1
        raise TimeoutError()

    monkeypatch.setenv("QUERIT_API_KEY", "test-only")
    monkeypatch.setattr(jobs.llm, "is_configured", lambda provider: True)
    monkeypatch.setattr(jobs.llm, "complete", timeout)
    monkeypatch.setattr(jobs, "text_search", places)
    manager = DiscoveryJobs(engine, Provider())
    query = "laundromat in NYC"
    job = manager.start(DiscoveryRequest(q=query, live=True), intent=parse_intent(query))
    await job.task
    assert job.status == "partial" and len(job.results) == 1
    assert len(engine.store.list_markets()) == 1
    detail = engine.company_out(engine.store.list_companies()[0])
    assert detail["city"] == "New York"
    assert detail["rating"] == 4.5
    assert detail["financials"]["revenue_est"] is None
    assert detail["sources"][0]["url"] == place["source_url"]
    assert any(event["type"] == "company_ready" for event in job.events)
    await manager.close()


@pytest.mark.asyncio
async def test_provider_failure_keeps_matches_and_retry_starts_new_job(monkeypatch):
    from app.services.discovery import jobs
    engine = Engine(MemoryStore())
    engine.create_company({"name": "Test Miami Laundry", "city": "Miami", "state": "FL", "category": "laundromat"})
    manager = DiscoveryJobs(engine)
    async def fail(job):
        raise RuntimeError("provider-secret-must-not-escape")
    monkeypatch.setenv("QUERIT_API_KEY", "test-only")
    monkeypatch.setattr(jobs.llm, "is_configured", lambda provider: True)
    monkeypatch.setattr(manager, "live", fail)
    request = DiscoveryRequest(q="laundromat in Miami", live=True)
    job = manager.start(request)
    await job.task
    assert job.status == "partial" and len(job.results) == 1
    assert "provider-secret" not in json.dumps(job.events)
    next_job = manager.start(request)
    assert next_job.id != job.id
    await next_job.task
    await manager.close()


def test_rest_replay_and_validation(monkeypatch):
    from app.main import app
    from app.routers import discovery
    manager = DiscoveryJobs(Engine(MemoryStore()))
    monkeypatch.setattr(discovery, "service", lambda: manager)
    with TestClient(app) as client:
        assert client.post("/api/v1/discovery/search", json={"q": "   "}).status_code == 400
        assert client.post("/api/v1/discovery/search", json={"q": "a" * 501}).status_code == 422
        response = client.post("/api/v1/discovery/search", json={"q": "laundromat in Chicago", "live": False})
        assert response.status_code == 202
        url = f"/api/v1/discovery/jobs/{response.json()['job_id']}"
        first = client.get(url)
        assert "text/event-stream" in first.headers["content-type"]
        frames = [json.loads(line[6:]) for line in first.text.splitlines() if line.startswith("data: ")]
        assert frames[-1]["type"] == "done" and frames[-1]["total"] == 0
        replay = client.get(url, headers={"Last-Event-ID": "1"})
        assert "\"type\": \"intent\"" not in replay.text
        assert "\"type\": \"done\"" in replay.text
        assert client.get(url, headers={"Last-Event-ID": "bad"}).status_code == 400
