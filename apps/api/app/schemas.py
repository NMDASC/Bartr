"""Shared API types. This file is the contract.

OWNERSHIP (Plan.md section 10) -- add fields freely, but renaming or removing
one needs a docs/DECISIONS.md entry plus regenerated
packages/contracts/{openapi.yaml,types.ts}:

    Company, CompanyProfile, Financials, Valuation, Source, Intent  -> Zhiyuan
    OrderRequest, Order, Book, BookLevel, Batch, Trade              -> Nico
    Belief, Suggestion, Flag                                        -> Aditya
    UserOut, Health, job/session envelopes                          -> Vir

Prices are floats in the contract so JSON stays numeric for the frontend.
Use Decimal inside the matching engine and convert at the boundary.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Side(str, Enum):
    buy = "buy"
    sell = "sell"


class OrderStatus(str, Enum):
    open = "open"
    filled = "filled"
    partial = "partial"
    cancelled = "cancelled"


class OrderOrigin(str, Enum):
    user = "user"
    mm = "mm"
    agent = "agent"


class CompanyStatus(str, Enum):
    stub = "stub"
    ready = "ready"
    failed = "failed"


# --- platform ---------------------------------------------------------------


class Health(BaseModel):
    status: str = "ok"
    env: str
    database: bool
    demo_auth: bool


class UserOut(BaseModel):
    id: str
    name: str
    email: str | None = None
    cash: float
    auth_provider: str


# --- discovery (Zhiyuan) ----------------------------------------------------


class Source(BaseModel):
    url: str
    title: str | None = None
    snippet: str | None = None
    fetched_at: datetime | None = None


class Financials(BaseModel):
    revenue_est: float | None = None
    sde_est: float | None = None
    margin_est: float | None = None
    employees_est: int | None = None
    confidence: float = Field(ge=0, le=1, default=0.5)
    method: str = "proxy"


class Valuation(BaseModel):
    v0: float
    sigma: float
    low: float
    high: float
    multiple_used: float | None = None
    as_of: datetime | None = None


class MarketSummary(BaseModel):
    market_id: str
    bid: float | None = None
    ask: float | None = None
    last: float | None = None
    next_batch_at: datetime | None = None
    halted: bool = False


class CompanyCard(BaseModel):
    id: str
    name: str
    category: str
    city: str | None = None
    state: str | None = None
    rating: float | None = None
    review_count: int | None = None
    status: CompanyStatus = CompanyStatus.stub
    valuation: Valuation | None = None
    market: MarketSummary | None = None


class Company(CompanyCard):
    address: str | None = None
    website: str | None = None
    phone: str | None = None
    description: str | None = None
    owners: list[str] = []
    founded_year: int | None = None
    financials: Financials | None = None
    sources: list[Source] = []


class Intent(BaseModel):
    category: str | None = None
    naics_guess: str | None = None
    state: str | None = None
    city: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    must_have: list[str] = []


class SearchRequest(BaseModel):
    q: str


class SearchAccepted(BaseModel):
    job_id: str
    intent: Intent


# --- market (Nico) ----------------------------------------------------------


class OrderRequest(BaseModel):
    side: Side
    qty: float = Field(gt=0)
    limit_price: float = Field(gt=0)


class Order(BaseModel):
    id: str
    market_id: str
    user_id: str
    side: Side
    qty: float
    limit_price: float
    status: OrderStatus = OrderStatus.open
    filled_qty: float = 0
    origin: OrderOrigin = OrderOrigin.user
    created_at: datetime


class BookLevel(BaseModel):
    price: float
    qty: float


class Book(BaseModel):
    market_id: str
    bids: list[BookLevel] = []
    asks: list[BookLevel] = []
    last: float | None = None
    ref: float | None = None
    next_batch_at: datetime | None = None
    band: float = 0.10


class Trade(BaseModel):
    id: str
    market_id: str
    batch_id: str
    qty: float
    price: float
    t: datetime


class Batch(BaseModel):
    id: str
    market_id: str
    t: datetime
    clearing_price: float
    volume: float
    imbalance: float = 0
    n_buy: int = 0
    n_sell: int = 0


# --- portfolio (Aditya) -----------------------------------------------------


class RiskProfile(BaseModel):
    tolerance: float = Field(ge=0, le=1, default=0.5)
    horizon: str = "medium"
    sectors: list[str] = []
    states: list[str] = []
    budget: float = 100_000


class Position(BaseModel):
    market_id: str
    company_name: str | None = None
    qty: float
    avg_cost: float
    last: float | None = None
    unrealized: float | None = None


class Portfolio(BaseModel):
    cash: float
    positions: list[Position] = []
    pnl: float = 0


class Suggestion(BaseModel):
    company: CompanyCard
    edge: float
    sigma: float
    kelly_fraction: float
    suggested_usd: float
    why: str


# --- acquire / agent / surveillance ----------------------------------------


class ChecklistItem(BaseModel):
    item: str
    why: str | None = None
    source: Source | None = None
    done: bool = False


class AcquisitionStart(BaseModel):
    acquisition_id: str
    loi_md: str
    checklist: list[ChecklistItem] = []


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class Flag(BaseModel):
    id: str
    market_id: str
    batch_id: str | None = None
    rule: str
    severity: str
    subjects: list[str] = []
    explanation: str
    reviewer: str
    t: datetime


class AuditEntry(BaseModel):
    id: str
    t: datetime
    actor: str
    action: str
    payload_hash: str
