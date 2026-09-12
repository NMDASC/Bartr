/**
 * JB shared types. PRE-FREEZE DRAFT, written by A (frontend) at 21:30 Fri so the web app
 * can build against real shapes before the 23:30 contract freeze.
 *
 * After the freeze this file is REGENERATED from apps/api /openapi.json:
 *   pnpm dlx openapi-typescript ../../packages/contracts/openapi.yaml -o types.ts
 * Until then, treat every field here as a proposal. B and C: if a shape is wrong,
 * change it here and log it in docs/DECISIONS.md rather than diverging silently.
 *
 * Matching fixtures live in ./examples/*.json.
 */

// ---------------------------------------------------------------- primitives

export type Iso = string; // ISO 8601 UTC, server generated
export type Side = "buy" | "sell";
export type Origin = "user" | "treasury" | "bot" | "agent";
export type CompanyStatus = "stub" | "ready" | "failed";
export type Severity = "benign" | "low" | "medium" | "high";
export type Reviewer = "rules" | "grok" | "k2";
export type ValuationMethod = "extracted" | "proxy";

// ---------------------------------------------------------------- discovery

export interface Source {
  url: string;
  title: string;
  snippet: string;
  fetched_at: Iso;
}

export interface FieldEvidence {
  field: string;
  value: number | string | boolean | null;
  source_url: string;
  quote: string;
  status: "reported" | "inferred";
  currency?: string | null;
  period?: string | null;
  fetched_at?: Iso | null;
}

export interface Financials {
  revenue_est: number | null;
  sde_est: number | null;
  margin_est: number | null;
  employees_est: number | null;
  /** 0..1. Drives sigma in the valuation and market maker depth. */
  confidence: number;
  method: ValuationMethod;
}

/** One estimator's opinion inside the Bayesian ensemble (Plan 8.2, decision 004). */
export interface Estimate {
  name: "listing" | "income" | "proxy" | "llm" | "base_rate" | string;
  /** USD, whole company. e^mu. */
  value: number;
  /** log sigma of this estimator alone */
  sigma: number;
  note: string;
}

export interface Valuation {
  version?: string;
  calibration_version?: string | null;
  benchmark_version?: string;
  benchmark_status?: string;
  opening_price?: number;
  warnings?: string[];
  /** Posterior median, USD, whole company. Divide by shares_outstanding for per share. */
  v0: number;
  /** Posterior log sigma after disagreement inflation. 0.12 .. 0.90. */
  sigma: number;
  /** P20 */
  low: number;
  /** P80 */
  high: number;
  /** e.g. "income+llm+base_rate" */
  method: string;
  /** weighted std of estimator means around the posterior, for display */
  disagreement: number;
  estimates: Estimate[];
  as_of: Iso;
}

export interface Belief {
  mu: number;
  sigma: number;
  s_m: number;
  n_rounds: number;
}

/** Owner liquidity (decision 003). The platform never trades. */
export interface Treasury {
  unsold_float: number;
  proceeds: number;
  floor_price: number;
  floor_qty: number;
  bought_back: number;
  ask_ladder: { price: number; qty: number }[];
}

export interface MarketSummary {
  shares_outstanding: number;
  /** shares offered by the owner at listing (30%) */
  float: number;
  /** owner retained stake, only moves through acquisition */
  retained: number;
  tick: number;
  last_price: number | null;
  ref_price: number | null;
  batch_interval_s: number;
  next_batch_at: Iso;
  band_pct: number;
  belief: Belief | null;
  treasury: Treasury | null;
  fees_collected: number;
  halted: boolean;
}

export interface Company {
  evidence?: FieldEvidence[];
  _id: string;
  name: string;
  category: string;
  naics_guess: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  review_count: number;
  founded_year: number | null;
  owners: string[];
  description: string | null;
  financials: Financials | null;
  valuation: Valuation | null;
  sources: Source[];
  status: CompanyStatus;
  created_at: Iso;
  market: MarketSummary | null;
}

/** Row shape for /search and /companies. Nulls are expected while status is "stub". */
export interface CompanyCard {
  /** Query-specific; unrelated to financial confidence. */
  relevance?: Relevance;
  _id: string;
  name: string;
  category: string;
  city: string | null;
  state: string | null;
  rating: number | null;
  review_count: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  v0_per_share: number | null;
  confidence: number | null;
  status: CompanyStatus;
}

export interface SearchIntent {
  category: string;
  naics_guess: string | null;
  state: string | null;
  city: string | null;
  min_value: number | null;
  max_value: number | null;
  must_have: string[];
}

export interface SearchJobAccepted {
  job_id: string;
  intent: SearchIntent;
}

/** SSE frames on GET /discovery/jobs/{id}. */
export type DiscoveryEvent =
  | { type: "ranking"; revision: number; companies: CompanyCard[] }
  | { type: "error"; message: string }
  | { type: "intent"; intent: SearchIntent }
  | { type: "company_stub"; company: CompanyCard }
  | { type: "company_ready"; company: CompanyCard }
  | { type: "company_failed"; company_id: string; reason: string }
  | { type: "done"; total: number; warnings?: string[]; status?: string };

export interface Relevance {
  rank: number;
  score: number;
  semantic: number;
  keyword: number;
  preference: number;
  evidence: number;
  matched: string[];
  unknown: string[];
  version: string;
  semantic_method: string;
}

// ---------------------------------------------------------------- market

export interface BookLevel {
  price: number;
  qty: number;
  origin: Origin;
}

export interface Book {
  market_id: string;
  bids: BookLevel[]; // descending price
  asks: BookLevel[]; // ascending price
  last: number | null;
  ref: number | null;
  next_batch_at: Iso;
  band: { pct: number; low: number; high: number };
  halted: boolean;
}

export interface Order {
  _id: string;
  market_id: string;
  user_id: string;
  side: Side;
  qty: number;
  limit_price: number;
  status: "open" | "filled" | "partial" | "cancelled";
  filled_qty: number;
  origin: Origin;
  created_at: Iso;
  cancelled_at: Iso | null;
}

export interface Batch {
  _id: string;
  market_id: string;
  t: Iso;
  clearing_price: number;
  volume: number;
  /** demand minus supply at the clearing price. Signed. */
  imbalance: number;
  n_buy: number;
  n_sell: number;
  book_snapshot?: { bids: BookLevel[]; asks: BookLevel[] };
}

export interface Trade {
  _id: string;
  market_id: string;
  batch_id: string;
  buyer_id: string;
  seller_id: string;
  qty: number;
  price: number;
  t: Iso;
}

/** Frames on WS /ws/markets/{id}. */
export type MarketEvent =
  | { type: "book"; book: Book }
  | { type: "batch"; batch: Batch }
  | { type: "trade"; trade: Trade }
  | { type: "flag"; flag: Flag }
  | { type: "halt"; market_id: string; until_batch: number; reason: string };

// ---------------------------------------------------------------- portfolio

export interface Position {
  market_id: string;
  name: string;
  qty: number;
  avg_cost: number;
  last: number | null;
  value: number;
  pnl: number;
}

export interface Portfolio {
  cash: number;
  pnl: { realized: number; unrealized: number; total: number };
  positions: Position[];
}

export interface RiskProfile {
  /** 0..1, maps to the Kelly multiplier 0.25 .. 1.0 via the risk slider. */
  tolerance: number;
  horizon: "short" | "medium" | "long";
  sectors: string[];
  states: string[];
  budget: number;
}

export interface Suggestion {
  company: Pick<CompanyCard, "_id" | "name" | "city" | "state" | "category">;
  price: number;
  model_value: number;
  /** ln(model_value / price). Negative means overpriced. */
  edge: number;
  sigma: number;
  /** Post clamp: half Kelly, capped at 0.20. */
  kelly_fraction: number;
  suggested_usd: number;
  why: string;
}

// ---------------------------------------------------------------- acquire

export interface ChecklistItem {
  item: string;
  why: string;
  citation: { url: string; title: string } | null;
  done: boolean;
}

export interface Acquisition {
  acquisition_id: string;
  market_id: string;
  loi_md: string;
  checklist: ChecklistItem[];
  status: "draft" | "sent" | "closed";
}

// ---------------------------------------------------------------- surveillance

export interface Flag {
  _id: string;
  market_id: string;
  batch_id: string;
  rule:
    | "wash_trading"
    | "spoofing"
    | "pump"
    | "band_abuse"
    | "concentration"
    | "volatility_halt_candidate";
  severity: Severity;
  subjects: string[];
  explanation: string;
  reviewer: Reviewer;
  /** One entry per reviewer. Present so the UI can show disagreement. */
  reviews: { reviewer: Reviewer; severity: Severity }[];
  /** True when grok and k2 disagree on severity. */
  disputed: boolean;
  t: Iso;
}

export interface AuditEntry {
  _id: string;
  t: Iso;
  actor: string;
  action: string;
  payload_hash: string;
  payload: unknown;
}

// ---------------------------------------------------------------- agent

export interface ToolCallCard {
  name:
    | "search_companies"
    | "get_company"
    | "get_book"
    | "place_order"
    | "suggest_portfolio";
  args: Record<string, unknown>;
  result_count: number;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallCard[];
}

/**
 * Transport agnostic. The web chat page and the iMessage bridge hit the same endpoint.
 * session_id is the Auth0 sub on web and the phone number (E.164) over iMessage.
 */
export interface AgentChatRequest {
  session_id: string;
  message: string;
}
