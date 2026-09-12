"""Typed GraphQL facade over shared discovery and pricing, not a second engine."""
from __future__ import annotations

from dataclasses import asdict
import strawberry
from strawberry.extensions import QueryDepthLimiter
from strawberry.fastapi import GraphQLRouter
from app.schemas import SearchIntent
from app.services.discovery.jobs import service
from app.services.discovery.models import DiscoveryRequest, RankInfo
from app.services.discovery.pricing import preview


@strawberry.experimental.pydantic.type(model=SearchIntent, all_fields=True)
class Intent:
    pass


@strawberry.experimental.pydantic.type(model=RankInfo, all_fields=True)
class Relevance:
    pass


@strawberry.type
class CompanyCard:
    id: strawberry.ID
    name: str
    category: str
    city: str | None
    state: str | None
    rating: float | None
    review_count: int
    bid: float | None
    ask: float | None
    last: float | None
    v0_per_share: float | None
    confidence: float | None
    status: str

    @classmethod
    def from_dict(cls, c):
        return cls(id=strawberry.ID(c["_id"]), **{k: c.get(k) for k in cls.__annotations__ if k != "id"})


@strawberry.type
class Estimate:
    name: str
    value: float
    sigma: float
    note: str


@strawberry.type
class Valuation:
    v0: float
    low: float
    high: float
    sigma: float
    method: str
    estimates: list[Estimate]
    opening_price: float
    version: str
    calibration_version: str | None
    benchmark_status: str
    as_of: str | None
    warnings: list[str]

    @classmethod
    def from_dict(cls, v):
        return cls(v0=v["v0"], low=v["low"], high=v["high"], sigma=v["sigma"], method=v["method"],
                   estimates=[Estimate(**e) for e in v["estimates"]], opening_price=v.get("opening_price", round(v["v0"]/10000, 2)),
                   version=v.get("version", "legacy-ensemble"), calibration_version=v.get("calibration_version"),
                   benchmark_status=v.get("benchmark_status", "provisional"), as_of=v.get("as_of"),
                   warnings=v.get("warnings", ["Uncalibrated benchmark and uncertainty priors"]))


@strawberry.type
class Evidence:
    field: str
    value: str
    source_url: str
    quote: str
    status: str
    currency: str | None
    period: str | None


@strawberry.type
class Source:
    url: str
    title: str
    snippet: str
    fetched_at: str


@strawberry.type
class CompanyDetail:
    id: strawberry.ID
    name: str
    category: str
    city: str | None
    state: str | None
    description: str | None
    valuation: Valuation
    evidence: list[Evidence]
    sources: list[Source]
    valuation_history: list[Valuation]


@strawberry.type
class SearchHit:
    company: CompanyCard
    relevance: Relevance


@strawberry.type
class SearchResults:
    hits: list[SearchHit]
    total: int
    revision: int
    end_cursor: str | None
    has_next_page: bool


@strawberry.type
class DiscoveryJob:
    id: strawberry.ID
    intent: Intent
    status: str
    warnings: list[str]
    revision: int

    @classmethod
    def from_job(cls, job):
        return cls(id=strawberry.ID(job.id), intent=Intent.from_pydantic(SearchIntent(**job.intent)),
                   status=job.status, warnings=job.warnings, revision=job.revision)


@strawberry.input
class DiscoveryInput:
    q: str
    live: bool | None = None
    limit: int = 20


@strawberry.input
class ValuationInput:
    category: str = "default"
    state: str | None = None
    revenue: float | None = None
    sde: float | None = None
    asking_price: float | None = None
    employees: int | None = None
    machines: int | None = None
    rating: float | None = None
    review_count: int | None = None
    years_operating: int | None = None
    owner_operated: bool | None = None


@strawberry.type
class Query:
    @strawberry.field
    async def discovery_job(self, id: strawberry.ID) -> DiscoveryJob:
        return DiscoveryJob.from_job(service().get(str(id)))

    @strawberry.field
    async def search_results(self, job_id: strawberry.ID, first: int = 20, after: str | None = None) -> SearchResults:
        page = service().page(str(job_id), first, after)
        return SearchResults(**{**page, "hits": [SearchHit(company=CompanyCard.from_dict(h["company"]),
            relevance=Relevance.from_pydantic(RankInfo(**h["relevance"]))) for h in page["hits"]]})

    @strawberry.field
    async def company(self, id: strawberry.ID) -> CompanyDetail | None:
        engine = service().engine
        c = engine.store.get_company(str(id))
        if c is None:
            return None
        out = engine.company_out(c)
        return CompanyDetail(id=id, name=c["name"], category=c["category"], city=c.get("city"), state=c.get("state"),
            description=c.get("description"), valuation=Valuation.from_dict(out["valuation"]),
            evidence=[Evidence(field=e["field"], value=str(e["value"]), source_url=e["source_url"], quote=e["quote"],
                status=e["status"], currency=e.get("currency"), period=e.get("period")) for e in c.get("evidence", [])],
            sources=[Source(**s) for s in out["sources"]],
            valuation_history=[Valuation.from_dict(v) for v in c.get("valuation_history", [])])

    @strawberry.field
    async def preview_valuation(self, input: ValuationInput) -> Valuation:
        return Valuation.from_dict(preview(asdict(input)))


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def start_discovery(self, input: DiscoveryInput) -> DiscoveryJob:
        return DiscoveryJob.from_job(service().start(DiscoveryRequest(**asdict(input))))


schema = strawberry.Schema(query=Query, mutation=Mutation, extensions=[lambda: QueryDepthLimiter(max_depth=8)])
router = GraphQLRouter(schema)
