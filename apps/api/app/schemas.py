"""API contract models, matched to packages/contracts/types.ts (decision 005 by A, 008 by C).
Changing anything here needs a docs/DECISIONS.md entry (see CLAUDE.md)."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Side = Literal["buy", "sell"]
Origin = Literal["user", "treasury", "bot", "agent"]
CompanyStatus = Literal["stub", "ready", "failed"]


# ---------------------------------------------------------------- inputs

class ObservablesIn(BaseModel):
    category: str = "default"
    state: str | None = None
    revenue: float | None = None
    sde: float | None = None
    asking_price: float | None = None
    employees: int | None = None
    rating: float | None = None
    review_count: int | None = None
    years_operating: int | None = None
    owner_operated: bool | None = None
    llm_estimate: float | None = None
    llm_confidence: float | None = None
    llm2_estimate: float | None = None
    machines: int | None = None
    sources: list[str] = Field(default_factory=list)


class CompanyIn(ObservablesIn):
    id: str | None = None
    name: str
    city: str | None = None
    address: str | None = None
    description: str | None = None
    website: str | None = None
    phone: str | None = None
    naics_guess: str | None = None
    lat: float | None = None
    lng: float | None = None
    owners: list[str] = Field(default_factory=list)


class OrderIn(BaseModel):
    side: Side
    qty: float = Field(gt=0)
    limit_price: float = Field(gt=0)


class SuggestIn(BaseModel):
    bankroll: float | None = None
    kelly_multiplier: float = 0.5
    own_values: dict[str, float] = Field(default_factory=dict)  # market_id -> user's own value per share
    states: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    exclude_held: bool = True


class SearchIn(BaseModel):
    q: str


# ---------------------------------------------------------------- discovery

class Source(BaseModel):
    url: str
    title: str
    snippet: str
    fetched_at: str


class Financials(BaseModel):
    revenue_est: float | None
    sde_est: float | None
    margin_est: float | None
    employees_est: int | None
    confidence: float
    method: Literal["extracted", "proxy"]


class Estimate(BaseModel):
    name: str
    value: float
    sigma: float
    note: str


class Valuation(BaseModel):
    v0: float
    sigma: float
    low: float
    high: float
    method: str
    disagreement: float
    estimates: list[Estimate]
    as_of: str


class Belief(BaseModel):
    mu: float
    sigma: float
    s_m: float
    n_rounds: int
    model_value: float
    market_value: float


class Level(BaseModel):
    price: float
    qty: float


class Treasury(BaseModel):
    unsold_float: float
    proceeds: float
    floor_price: float
    floor_qty: float
    bought_back: float
    ask_ladder: list[Level]


class MarketSummary(BaseModel):
    shares_outstanding: int
    float: float
    retained: float
    tick: float
    last_price: float | None
    ref_price: float | None
    batch_interval_s: float
    next_batch_at: str
    band_pct: float
    belief: Belief | None
    treasury: Treasury | None
    fees_collected: float
    halted: bool


class Company(BaseModel):
    id: str = Field(alias="_id")
    name: str
    category: str
    naics_guess: str | None
    address: str | None
    city: str | None
    state: str | None
    lat: float | None
    lng: float | None
    website: str | None
    phone: str | None
    rating: float | None
    review_count: int
    founded_year: int | None
    owners: list[str]
    description: str | None
    financials: Financials | None
    valuation: Valuation | None
    sources: list[Source]
    status: CompanyStatus
    created_at: str
    market: MarketSummary | None
    observables: dict[str, Any]
    model_config = {"populate_by_name": True}


class CompanyCard(BaseModel):
    id: str = Field(alias="_id")
    name: str
    category: str
    city: str | None
    state: str | None
    rating: float | None
    review_count: int
    bid: float | None
    ask: float | None
    last: float | None
    indicative_price: float | None
    v0_per_share: float | None
    confidence: float | None
    status: CompanyStatus
    model_config = {"populate_by_name": True}


class SearchIntent(BaseModel):
    category: str
    naics_guess: str | None
    state: str | None
    city: str | None
    min_value: float | None
    max_value: float | None
    must_have: list[str]


class SearchJobAccepted(BaseModel):
    job_id: str
    intent: SearchIntent


# ---------------------------------------------------------------- market

class BookLevel(BaseModel):
    price: float
    qty: float
    origin: Origin


class Band(BaseModel):
    pct: float
    low: float | None
    high: float | None


class Book(BaseModel):
    market_id: str
    bids: list[BookLevel]
    asks: list[BookLevel]
    last: float | None
    ref: float | None
    indicative_price: float | None
    next_batch_at: str
    band: Band
    halted: bool
    n_open_orders: int


class Order(BaseModel):
    id: str = Field(alias="_id")
    market_id: str
    user_id: str
    side: Side
    qty: float
    limit_price: float
    status: Literal["open", "filled", "partial", "cancelled"]
    filled_qty: float
    origin: Origin
    created_at: str
    cancelled_at: str | None
    model_config = {"populate_by_name": True}


class Batch(BaseModel):
    id: str = Field(alias="_id")
    market_id: str
    t: str
    clearing_price: float | None
    volume: float
    imbalance: float
    n_buy: int
    n_sell: int
    band_hit: bool
    ref_moved: bool
    book_snapshot: dict | None = None
    model_config = {"populate_by_name": True}


class Trade(BaseModel):
    id: str = Field(alias="_id")
    market_id: str
    batch_id: str
    buyer_id: str
    seller_id: str
    qty: float
    price: float
    t: str
    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------- portfolio

class Position(BaseModel):
    market_id: str
    name: str
    qty: float
    avg_cost: float
    last: float | None
    value: float
    pnl: float


class Pnl(BaseModel):
    realized: float
    unrealized: float
    total: float


class Portfolio(BaseModel):
    user_id: str
    cash: float
    reserved_cash: float
    equity: float
    pnl: Pnl
    positions: list[Position]


class SuggestionCompany(BaseModel):
    id: str = Field(alias="_id")
    name: str
    city: str | None
    state: str | None
    category: str
    model_config = {"populate_by_name": True}


class Suggestion(BaseModel):
    company: SuggestionCompany
    price: float
    model_value: float
    edge: float
    sigma: float
    kelly_fraction: float
    suggested_usd: float
    why: str


# ---------------------------------------------------------------- acquire, surveillance

class ChecklistItem(BaseModel):
    item: str
    why: str
    citation: dict | None
    done: bool = False


class Acquisition(BaseModel):
    acquisition_id: str
    market_id: str
    loi_md: str
    checklist: list[ChecklistItem]
    status: Literal["draft", "sent", "closed"] = "draft"


class Review(BaseModel):
    reviewer: Literal["rules", "grok", "k2"]
    severity: Literal["benign", "low", "medium", "high"]


class Flag(BaseModel):
    id: str = Field(alias="_id")
    market_id: str
    batch_id: str
    rule: str
    severity: Literal["benign", "low", "medium", "high"]
    subjects: list[str]
    explanation: str
    reviewer: Literal["rules", "grok", "k2"]
    reviews: list[Review]
    disputed: bool
    t: str
    model_config = {"populate_by_name": True}
