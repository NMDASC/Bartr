"""API contract models. Changing anything here needs a docs/DECISIONS.md entry (see CLAUDE.md)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


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
    name: str
    city: str | None = None
    address: str | None = None
    description: str | None = None
    website: str | None = None
    owners: list[str] = Field(default_factory=list)


class EstimateOut(BaseModel):
    name: str
    value: float
    sigma: float
    note: str


class ValuationOut(BaseModel):
    v0: float
    sigma: float
    low: float
    high: float
    method: str
    disagreement: float
    estimates: list[EstimateOut]


class Level(BaseModel):
    price: float
    qty: float


class TreasuryOut(BaseModel):
    unsold_float: float
    proceeds: float
    floor_price: float
    floor_qty: float
    bought_back: float
    ask_ladder: list[Level]


class BeliefOut(BaseModel):
    mu: float
    sigma: float
    model_value: float
    market_value: float
    n_rounds: int


class MarketOut(BaseModel):
    id: str
    shares_outstanding: int
    float_shares: float
    retained: float
    last_price: float | None
    ref_price: float
    batch_interval_s: float
    next_batch_at: float
    band_pct: float
    halted: bool
    belief: BeliefOut
    treasury: TreasuryOut


class CompanyOut(BaseModel):
    id: str
    name: str
    category: str
    state: str | None
    city: str | None
    address: str | None
    description: str | None
    website: str | None
    owners: list[str]
    observables: ObservablesIn
    valuation: ValuationOut
    market: MarketOut | None = None


class CompanyCard(BaseModel):
    id: str
    name: str
    category: str
    state: str | None
    city: str | None
    v0: float
    sigma: float
    last_price: float | None
    best_bid: float | None
    best_ask: float | None
    indicative_price: float | None
    next_batch_at: float


class BookOut(BaseModel):
    market_id: str
    bids: list[Level]
    asks: list[Level]
    last_price: float | None
    ref_price: float
    indicative_price: float | None
    next_batch_at: float
    band_pct: float
    n_open_orders: int


class OrderIn(BaseModel):
    side: Literal["buy", "sell"]
    qty: float = Field(gt=0)
    limit_price: float = Field(gt=0)


class OrderOut(BaseModel):
    id: str
    market_id: str
    user_id: str
    side: str
    qty: float
    filled_qty: float
    limit_price: float
    status: Literal["open", "filled", "partial", "cancelled", "rejected"]
    origin: str
    created_at: float
    reason: str | None = None


class BatchOut(BaseModel):
    id: str
    market_id: str
    t: float
    clearing_price: float | None
    volume: float
    demand: float
    supply: float
    band_hit: bool
    n_buy: int
    n_sell: int
    ref_moved: bool = False
    book_snapshot: dict


class TradeOut(BaseModel):
    id: str
    market_id: str
    batch_id: str
    buyer_id: str
    seller_id: str
    qty: float
    price: float
    t: float


class PositionOut(BaseModel):
    market_id: str
    name: str
    qty: float
    avg_cost: float
    last_price: float | None
    market_value: float
    pnl: float


class PortfolioOut(BaseModel):
    user_id: str
    cash: float
    reserved_cash: float
    positions: list[PositionOut]
    equity: float
    pnl: float


class SuggestIn(BaseModel):
    bankroll: float | None = None
    kelly_multiplier: float = 0.5
    own_values: dict[str, float] = Field(default_factory=dict)  # market_id -> user's own value per share
    states: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    exclude_held: bool = True


class SuggestionOut(BaseModel):
    market_id: str
    name: str
    price: float
    value: float
    sigma: float
    mu: float
    f: float
    usd: float
    why: str


# ---------------------------------------------------------------- discovery

class SearchIntent(BaseModel):
    category: str
    naics_guess: str | None = None
    state: str | None = None
    city: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    must_have: list[str] = []


class SearchJobAccepted(BaseModel):
    job_id: str
    intent: SearchIntent


# ---------------------------------------------------------------- acquire

class Citation(BaseModel):
    url: str
    title: str


class ChecklistItem(BaseModel):
    item: str
    why: str
    citation: Citation | None = None
    done: bool = False


class Acquisition(BaseModel):
    acquisition_id: str
    market_id: str
    loi_md: str
    checklist: list[ChecklistItem] = []
    status: Literal["draft", "sent", "closed"] = "draft"


# ---------------------------------------------------------------- agent

class ToolCallCard(BaseModel):
    name: str
    args: dict = {}
    result_count: int = 0


class AgentMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    tool_calls: list[ToolCallCard] | None = None


class AgentChatRequest(BaseModel):
    session_id: str
    message: str
