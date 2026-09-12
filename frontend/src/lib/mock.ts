/**
 * Mock backend. Fixtures from packages/contracts/examples plus a small in-browser
 * implementation of the frequent batch auction (Plan.md 8.3), the owner Treasury ladder and
 * buyback floor (8.1, decision 003), and the belief update between rounds (8.2b), so the
 * company page is live before the real engine lands.
 *
 * This is a reference, not the engine. C owns the real one in apps/api/services/market.
 */

import type {
  Acquisition,
  Batch,
  Book,
  BookLevel,
  Company,
  CompanyCard,
  DiscoveryEvent,
  Flag,
  Offer,
  OfferIn,
  Order,
  Portfolio,
  SearchIntent,
  Side,
  Suggestion,
} from "@contracts/types";
import type { MarketFrame } from "./api";

import companyFixture from "@contracts/examples/company.json";
import cardsFixture from "@contracts/examples/company-cards.json";
import portfolioFixture from "@contracts/examples/portfolio.json";
import suggestFixture from "@contracts/examples/suggest.json";
import flagsFixture from "@contracts/examples/flags.json";
import acquireFixture from "@contracts/examples/acquire.json";

const CARDS = cardsFixture as unknown as CompanyCard[];
const COMPANY = companyFixture as unknown as Company;
const SHARES = 10000;
const INTERVAL_S = 10;
const FLOAT = 3000; // owner offers 30% at listing
const FLOOR_QTY = 1000; // owner buys back up to 10% at the floor
const S_M = 0.1; // observation noise of a clearing price, log space
const FEE = 0.005;
const Z = { p20: -0.8416, ladder: [0.1257, 0.2859, 0.4538, 0.6356, 0.8416] }; // z(0.20), z(0.55..0.80)
const CACHED_DEMO_EMAIL = "hackcmu@gmail.com";

const CACHED_DEMO_PORTFOLIO: Portfolio = {
  cash: 58_420,
  pnl: { realized: 2_840, unrealized: 4_976, total: 7_816 },
  positions: [
    { market_id: "co_three_rivers_hvac", name: "Three Rivers Heating and Cooling", qty: 140, avg_cost: 76.2, last: 83.39, value: 11_674.6, pnl: 1_006.6 },
    { market_id: "co_mon_valley_auto", name: "Monongahela Auto Works", qty: 220, avg_cost: 55.4, last: 61.2, value: 13_464, pnl: 1_276 },
    { market_id: "co_schenley_daycare", name: "Schenley Park Kids Academy", qty: 95, avg_cost: 64.8, last: 70.56, value: 6_703.2, pnl: 547.2 },
  ],
};

const CACHED_DEMO_SUGGESTIONS: Suggestion[] = [
  {
    company: { _id: "co_three_rivers_hvac", name: "Three Rivers Heating and Cooling", city: "Pittsburgh", state: "PA", category: "hvac" },
    price: 83.39,
    model_value: 85,
    edge: 0.0191,
    sigma: 0.36,
    kelly_fraction: 0.0737,
    suggested_usd: 4_305,
    why: "Strong local demand, documented operations, and room between the market and appraised value.",
  },
  {
    company: { _id: "co_mon_valley_auto", name: "Monongahela Auto Works", city: "Homestead", state: "PA", category: "auto_repair" },
    price: 61.2,
    model_value: 60,
    edge: -0.0198,
    sigma: 0.4,
    kelly_fraction: 0,
    suggested_usd: 0,
    why: "Current pricing is above the appraisal, so the position stays on watch.",
  },
];

// ---------------------------------------------------------------- tiny seeded rng

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}
function gauss(r: () => number) {
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- discovery

export async function listCompanies(params: { q?: string; state?: string; category?: string }) {
  const q = params.q?.toLowerCase().trim();
  return CARDS.filter((c) => {
    if (params.state && c.state !== params.state) return false;
    if (params.category && c.category !== params.category) return false;
    if (!q) return true;
    const hay = `${c.name} ${c.city} ${c.state} ${c.category}`.toLowerCase();
    // loose: any query token hits
    return q.split(/\s+/).some((t) => t.length > 2 && hay.includes(t));
  });
}

export async function getCompany(id: string): Promise<Company | null> {
  const card = CARDS.find((c) => c._id === id);
  if (!card) return null;
  if (card.status === "stub") {
    return {
      ...COMPANY,
      _id: card._id,
      name: card.name,
      city: card.city,
      state: card.state,
      category: card.category,
      rating: card.rating,
      review_count: card.review_count,
      address: null,
      website: null,
      phone: null,
      owners: [],
      description: null,
      financials: null,
      valuation: null,
      sources: [],
      status: "stub",
      market: null,
    };
  }
  const m = market(id);
  const v0 = card.v0_per_share! * SHARES;
  const scale = v0 / COMPANY.valuation!.v0;
  const sigma = round2(0.15 + 0.6 * (1 - card.confidence!));
  const post = posterior(m);

  if (id === "co_bloomfield_coin") {
    return {
      ...COMPANY,
      evidence: [],
      _id: card._id,
      name: card.name,
      category: card.category,
      naics_guess: "812310",
      address: "4700 Liberty Ave, Pittsburgh, PA 15224",
      city: card.city,
      state: card.state,
      lat: 40.4613,
      lng: -79.9488,
      website: null,
      phone: null,
      rating: card.rating,
      review_count: card.review_count,
      founded_year: null,
      owners: [],
      description: "An unattended neighborhood laundry with limited public operating records.",
      financials: null,
      valuation: {
        v0,
        sigma: 0.62,
        low: 250_000,
        high: 708_000,
        method: "base_rate",
        disagreement: 0.46,
        estimates: [
          {
            name: "base_rate",
            value: v0,
            sigma: 0.7,
            note: "Category and location estimate with no verified operating financials.",
          },
        ],
        as_of: "2025-11-03T16:00:00Z",
      },
      sources: [
        {
          url: "https://www.google.com/maps",
          title: "Bloomfield Coin Laundry listing",
          snippet: "Business listing with address, hours, and customer reviews.",
          fetched_at: "2025-11-03T16:00:00Z",
        },
      ],
      status: "ready",
      listed: true,
      market: {
        listed: true,
        shares_outstanding: SHARES,
        float: FLOAT,
        retained: SHARES - FLOAT,
        tick: 0.01,
        last_price: m.last,
        ref_price: card.v0_per_share,
        batch_interval_s: INTERVAL_S,
        next_batch_at: new Date(m.nextBatchAt).toISOString(),
        band_pct: 0.1,
        belief: { mu: post.mu, sigma: 0.62, s_m: S_M, n_rounds: m.rounds },
        treasury: treasurySummary(m),
        fees_collected: round2(m.fees),
        halted: false,
      },
    };
  }

  return {
    ...COMPANY,
    _id: card._id,
    name: card.name,
    city: card.city,
    state: card.state,
    category: card.category,
    rating: card.rating,
    review_count: card.review_count,
    financials: COMPANY.financials && {
      ...COMPANY.financials,
      revenue_est: Math.round(COMPANY.financials.revenue_est! * scale),
      sde_est: Math.round(COMPANY.financials.sde_est! * scale),
      confidence: card.confidence!,
    },
    valuation: COMPANY.valuation && {
      ...COMPANY.valuation,
      v0,
      sigma,
      low: Math.round(v0 * Math.exp(-0.8416 * sigma)),
      high: Math.round(v0 * Math.exp(0.8416 * sigma)),
      estimates: COMPANY.valuation.estimates.map((e) => ({ ...e, value: Math.round(e.value * scale) })),
    },
    listed: true,
    market: {
      listed: true,
      shares_outstanding: SHARES,
      float: FLOAT,
      retained: SHARES - FLOAT,
      tick: 0.01,
      last_price: m.last,
      ref_price: card.v0_per_share,
      batch_interval_s: INTERVAL_S,
      next_batch_at: new Date(m.nextBatchAt).toISOString(),
      band_pct: 0.1,
      belief: { mu: post.mu, sigma: post.sigma, s_m: S_M, n_rounds: m.rounds },
      treasury: treasurySummary(m),
      fees_collected: round2(m.fees),
      halted: false,
    },
  };
}

export function streamSearch(
  q: string,
  onEvent: (e: DiscoveryEvent) => void,
  options: { cached?: boolean } = {},
): () => void {
  const timers: number[] = [];
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  const place = q.match(/\b(?:in|near|around)\s+(.+?)(?=\s+(?:under|over|with|below|above|for)\b|$)/i)?.[1];
  const city = place?.split(",")[0].trim() ?? null;
  const state = place?.match(/,\s*([a-z]{2})\b/i)?.[1].toUpperCase() ?? (/\bpittsburgh\b/i.test(q) ? "PA" : null);
  const category = /laundromat|laundry/i.test(q) ? "laundromat" : /car wash|carwash/i.test(q) ? "car_wash" : /machine shop/i.test(q) ? "machine_shop" : /restaurant/i.test(q) ? "restaurant" : "default";
  const amount = q.match(/\b(?:under|below)\s*\$?([\d,.]+)\s*(k|m|million|thousand)?\b/i);
  const maxValue = amount ? Number(amount[1].replaceAll(",", "")) * (/^(m|million)$/i.test(amount[2] ?? "") ? 1e6 : /^(k|thousand)$/i.test(amount[2] ?? "") ? 1e3 : 1) : null;
  const intent: SearchIntent = { category, naics_guess: null, state, city, min_value: null, max_value: maxValue, must_have: [] };
  const filtered = CARDS.filter(c => (!city || c.city?.toLowerCase() === city.toLowerCase()) && (!state || c.state === state)
    && (category === "default" || c.category === category) && (maxValue === null || c.v0_per_share !== null && c.v0_per_share * SHARES <= maxValue));
  const matches = (
    options.cached
      ? ["co_squirrel_hill_wash", "co_bloomfield_coin"]
          .map((id) => CARDS.find((company) => company._id === id))
          .filter((company): company is CompanyCard => Boolean(company))
      : filtered
  )
    .slice()
    .sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));

  const rankedStubs = matches.map((company) => ({
    ...company,
    bid: null,
    ask: null,
    last: null,
    v0_per_share: null,
    confidence: null,
    status: "stub" as const,
  }));

  at(400, () => onEvent({ type: "status", phase: "intent", message: "Reading business type and market", t: Date.now() }));
  at(1600, () => onEvent({ type: "intent", intent }));
  at(2800, () => onEvent({ type: "status", phase: "places", message: `Looking at places across ${city || state || "North America"}`, t: Date.now() }));
  at(4200, () => onEvent({ type: "status", phase: "category", message: `Finding options in ${category === "default" ? "local businesses" : category.replaceAll("_", " ")}`, t: Date.now() }));
  at(5000, () => onEvent({ type: "ranking", revision: 1, companies: rankedStubs }));
  at(6400, () => onEvent({ type: "status", phase: "records", message: options.cached ? "Loading saved company research" : "Checking financial and ownership records", t: Date.now() }));
  matches.forEach((c, i) => {
    if (c.status === "ready") at(8_200 + i * 1800, () => onEvent({ type: "company_ready", company: c }));
  });
  const doneAt = 9_000 + matches.length * 1800;
  at(doneAt - 200, () => onEvent({ type: "status", phase: "finished", message: `${matches.length} businesses ranked by research confidence`, t: Date.now() }));
  at(doneAt, () => onEvent({
    type: "done",
    total: matches.length,
    warnings: options.cached ? [] : ["Live search unavailable"],
    status: options.cached ? "complete" : "partial",
  }));
  return () => timers.forEach((t) => window.clearTimeout(t));
}

// ---------------------------------------------------------------- market simulator

interface UserOrder {
  id: string;
  user: string;
  side: Side;
  qty: number;
  limit: number;
  t: number;
}

interface MarketState {
  id: string;
  v0: number; // per share
  sigma: number;
  last: number;
  batches: Batch[];
  orders: UserOrder[];
  nextBatchAt: number;
  timer: number | null;
  subs: Set<(f: MarketFrame) => void>;
  r: () => number;
  n: number;
  // belief update (8.2b): sum of ln(clearing price) over rounds, and the round count
  sumLnP: number;
  rounds: number;
  // treasury (8.1)
  unsold: number;
  proceeds: number;
  boughtBack: number;
  fees: number;
}

const MARKETS = new Map<string, MarketState>();

function market(id: string): MarketState {
  let m = MARKETS.get(id);
  if (m) return m;
  const card = CARDS.find((c) => c._id === id);
  const v0 = card?.v0_per_share ?? 100;
  const sigma = 0.15 + 0.6 * (1 - (card?.confidence ?? 0.5));
  const r = rng(hash(id));
  // per-batch vol: belief sigma scaled down to a 10s step. Purely for demo feel.
  const step = sigma * 0.012;
  const now = Date.now();
  const batches: Batch[] = [];
  let p = v0;
  for (let i = 40; i >= 1; i--) {
    p = round2(p * Math.exp(gauss(r) * step - 0.5 * step * step + 0.002 * Math.log(v0 / p)));
    const nb = 3 + Math.floor(r() * 12);
    const ns = 3 + Math.floor(r() * 10);
    batches.push({
      _id: `b_${id}_${1000 - i}`,
      market_id: id,
      t: new Date(now - i * INTERVAL_S * 1000).toISOString(),
      clearing_price: p,
      volume: Math.round(30 + r() * 120),
      imbalance: Math.round((r() - 0.5) * 80),
      n_buy: nb,
      n_sell: ns,
    });
  }
  m = {
    id,
    v0,
    sigma,
    last: p,
    batches,
    orders: [],
    nextBatchAt: now + INTERVAL_S * 1000,
    timer: null,
    subs: new Set(),
    r,
    n: 1000,
    sumLnP: batches.reduce(
      (a, b) =>
        b.clearing_price === null ? a : a + Math.log(b.clearing_price * SHARES),
      0,
    ),
    rounds: batches.length,
    unsold: Math.round(FLOAT * 0.62),
    proceeds: 0,
    boughtBack: 0,
    fees: 0,
  };
  m.proceeds = round2((FLOAT - m.unsold) * v0 * 1.08);
  // a few resting bot orders so the book is not only the house
  for (let i = 0; i < 4; i++) m.orders.push(botOrder(m));
  MARKETS.set(id, m);
  return m;
}

/** Demo bot with a private noisy valuation v_i = v e^eps (Plan 8.6). Buys below it, sells above it. */
function botOrder(m: MarketState): UserOrder {
  const post = posterior(m);
  const vi = Math.exp(post.mu + gauss(m.r) * 0.06) / SHARES;
  const side: Side = vi > m.last ? "buy" : "sell";
  const limit = side === "buy" ? Math.min(vi, m.last * (1 + m.r() * 0.02)) : Math.max(vi, m.last * (1 - m.r() * 0.02));
  return {
    id: `o_${Math.random().toString(36).slice(2, 8)}`,
    user: `u_bot_${Math.floor(m.r() * 40)}`,
    side,
    qty: Math.round(10 + m.r() * 70),
    limit: round2(limit),
    t: Date.now(),
  };
}

/** 8.2b: precision weighted blend of the prior and the clearing prices seen so far. */
function posterior(m: MarketState) {
  const mu0 = Math.log(m.v0 * SHARES);
  const p0 = 1 / (m.sigma * m.sigma);
  const pm = m.rounds / (S_M * S_M);
  const mu = (mu0 * p0 + (m.rounds ? m.sumLnP / (S_M * S_M) : 0)) / (p0 + pm);
  const sigma = Math.max(0.12, Math.sqrt(1 / (p0 + pm)));
  return { mu, sigma };
}

function quantile(m: MarketState, z: number) {
  const { mu, sigma } = posterior(m);
  return round2(Math.exp(mu + sigma * z) / SHARES);
}

/** Owner ask ladder over the unsold float at P55..P80, and the buyback floor at P20. */
function treasuryQuotes(m: MarketState): BookLevel[] {
  const out: BookLevel[] = [{ price: quantile(m, Z.p20), qty: FLOOR_QTY - m.boughtBack, origin: "treasury" }];
  if (m.unsold > 0) {
    const per = Math.round((m.unsold / Z.ladder.length) * 100) / 100;
    for (const z of Z.ladder) out.push({ price: quantile(m, z), qty: per, origin: "treasury" });
  }
  return out.filter((l) => l.qty > 0);
}

function treasurySummary(m: MarketState) {
  const q = treasuryQuotes(m);
  const floor = q[0];
  return {
    unsold_float: m.unsold,
    proceeds: round2(m.proceeds),
    floor_price: floor?.price ?? 0,
    floor_qty: floor?.qty ?? 0,
    bought_back: m.boughtBack,
    ask_ladder: q.slice(1).map((l) => ({ price: l.price, qty: l.qty })),
  };
}

function buildBook(m: MarketState): Book {
  const quotes = treasuryQuotes(m);
  const bids: BookLevel[] = [quotes[0]];
  const asks: BookLevel[] = quotes.slice(1);
  for (const o of m.orders) {
    (o.side === "buy" ? bids : asks).push({ price: o.limit, qty: o.qty, origin: o.user.startsWith("u_bot") ? "bot" : "user" });
  }
  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);
  return {
    market_id: m.id,
    bids,
    asks,
    last: m.last,
    ref: m.v0,
    next_batch_at: new Date(m.nextBatchAt).toISOString(),
    band: { pct: 0.1, low: round2(m.last * 0.9), high: round2(m.last * 1.1) },
    halted: false,
  };
}

/** Uniform-price clearing, Plan.md 8.3. Exact scan over the candidate prices in the book. */
export function clear(bids: BookLevel[], asks: BookLevel[], last: number) {
  const prices = Array.from(new Set([...bids, ...asks].map((l) => l.price))).sort((a, b) => a - b);
  let best: { p: number; vol: number; imb: number } | null = null;
  for (const p of prices) {
    const d = bids.filter((b) => b.price >= p).reduce((s, b) => s + b.qty, 0);
    const s = asks.filter((a) => a.price <= p).reduce((t, a) => t + a.qty, 0);
    const vol = Math.min(d, s);
    const imb = d - s;
    if (
      !best ||
      vol > best.vol ||
      (vol === best.vol && Math.abs(imb) < Math.abs(best.imb)) ||
      (vol === best.vol && Math.abs(imb) === Math.abs(best.imb) && Math.abs(p - last) < Math.abs(best.p - last))
    ) {
      best = { p, vol, imb };
    }
  }
  return best ?? { p: last, vol: 0, imb: 0 };
}

function runBatch(m: MarketState) {
  // new bot interest each round
  const n = 1 + Math.floor(m.r() * 4);
  for (let i = 0; i < n; i++) m.orders.push(botOrder(m));
  if (m.orders.length > 14) m.orders.splice(0, m.orders.length - 14);

  const book = buildBook(m);
  const { p, vol, imb } = clear(book.bids, book.asks, m.last);
  // band clamp
  const lo = book.band.low;
  const hi = book.band.high;
  const px = Math.min(hi, Math.max(lo, p));

  const filled = m.orders.filter((o) => (o.side === "buy" ? o.limit >= px : o.limit <= px));
  m.orders = m.orders.filter((o) => !filled.includes(o));
  // owner side of the fills: ladder levels at or below px sell float, floor buys back if px <= floor
  const quotes = treasuryQuotes(m);
  const floor = quotes[0];
  const sold = quotes.slice(1).filter((l) => l.price <= px).reduce((a, l) => a + l.qty, 0);
  const soldNow = Math.min(sold, m.unsold, vol);
  m.unsold = Math.max(0, m.unsold - soldNow);
  m.proceeds += soldNow * px;
  if (floor && px <= floor.price) m.boughtBack = Math.min(FLOOR_QTY, m.boughtBack + Math.min(vol, floor.qty));
  m.fees += vol * px * FEE;
  m.last = px;
  m.n += 1;
  m.rounds += 1;
  m.sumLnP += Math.log(px * SHARES);
  const batch: Batch = {
    _id: `b_${m.id}_${m.n}`,
    market_id: m.id,
    t: new Date().toISOString(),
    clearing_price: px,
    volume: vol,
    imbalance: imb,
    n_buy: book.bids.filter((b) => b.origin !== "treasury").length,
    n_sell: book.asks.filter((a) => a.origin !== "treasury").length,
  };
  m.batches.push(batch);
  if (m.batches.length > 200) m.batches.shift();
  m.nextBatchAt = Date.now() + INTERVAL_S * 1000;

  const next = buildBook(m);
  for (const fn of m.subs) {
    fn({ type: "batch", batch });
    fn({ type: "book", book: next });
  }
}

function ensureRunning(m: MarketState) {
  if (m.timer !== null) return;
  const tick = () => {
    runBatch(m);
    m.timer = window.setTimeout(tick, INTERVAL_S * 1000);
  };
  m.timer = window.setTimeout(tick, Math.max(0, m.nextBatchAt - Date.now()));
}

export async function getBook(id: string): Promise<Book> {
  const card = CARDS.find((c) => c._id === id);
  if (!card || card.status !== "ready") {
    return { market_id: id, bids: [], asks: [], last: null, ref: null, next_batch_at: new Date().toISOString(), band: { pct: 0.1, low: 0, high: 0 }, halted: true };
  }
  return buildBook(market(id));
}

export async function getBatches(id: string, limit = 60): Promise<Batch[]> {
  const card = CARDS.find((c) => c._id === id);
  if (!card || card.status !== "ready") return [];
  return market(id).batches.slice(-limit);
}

export async function placeOrder(id: string, o: { side: Side; qty: number; limit_price: number }): Promise<Order> {
  const m = market(id);
  const order: UserOrder = { id: `o_${Math.random().toString(36).slice(2, 8)}`, user: "you", side: o.side, qty: o.qty, limit: round2(o.limit_price), t: Date.now() };
  m.orders.push(order);
  const book = buildBook(m);
  for (const fn of m.subs) fn({ type: "book", book });
  return {
    _id: order.id,
    market_id: id,
    user_id: "you",
    side: o.side,
    qty: o.qty,
    limit_price: order.limit,
    status: "open",
    filled_qty: 0,
    origin: "user",
    created_at: new Date(order.t).toISOString(),
    cancelled_at: null,
  };
}

export async function getMyOrders(id: string): Promise<Order[]> {
  const m = MARKETS.get(id);
  if (!m) return [];
  return m.orders
    .filter((o) => o.user === "you")
    .map((order) => ({
      _id: order.id,
      market_id: id,
      user_id: "you",
      side: order.side,
      qty: order.qty,
      limit_price: order.limit,
      status: "open" as const,
      filled_qty: 0,
      origin: "user" as const,
      created_at: new Date(order.t).toISOString(),
      cancelled_at: null,
    }));
}

export function subscribeMarket(id: string, onFrame: (f: MarketFrame) => void): () => void {
  const card = CARDS.find((c) => c._id === id);
  if (!card || card.status !== "ready") return () => {};
  const m = market(id);
  m.subs.add(onFrame);
  ensureRunning(m);
  return () => {
    m.subs.delete(onFrame);
  };
}

// ---------------------------------------------------------------- the rest, static fixtures

export async function getPortfolio(userId?: string) {
  if (userId?.trim().toLowerCase() === CACHED_DEMO_EMAIL) {
    return CACHED_DEMO_PORTFOLIO;
  }
  return portfolioFixture as unknown as Portfolio;
}
export async function suggest(userId?: string) {
  if (userId?.trim().toLowerCase() === CACHED_DEMO_EMAIL) {
    return CACHED_DEMO_SUGGESTIONS;
  }
  return suggestFixture as unknown as Suggestion[];
}
export async function flags() {
  return flagsFixture as unknown as Flag[];
}
export async function acquire(companyId: string) {
  return { ...(acquireFixture as unknown as Acquisition), market_id: companyId };
}

const offers = new Map<string, Offer>();
export async function makeOffer(companyId: string, body: OfferIn): Promise<Offer> {
  const c = await getCompany(companyId);
  const price = body.price ?? c?.valuation?.v0 ?? 250000;
  const o: Offer = {
    _id: `off_${Math.random().toString(36).slice(2, 10)}`, company_id: companyId, company_name: c?.name ?? companyId, buyer_id: "mock",
    buyer_name: body.buyer_name, price, status: "queued", delivery: "queued", created_at: new Date().toISOString(),
    email: { to: body.owner_email ?? null, subject: `An offer for ${c?.name ?? companyId}`,
      body: `To the owner of ${c?.name ?? companyId},\n\nMy name is ${body.buyer_name}. I would like to make you an offer of $${price.toLocaleString()} for the business as it stands today.\n\nSincerely,\n${body.buyer_name}` },
  };
  offers.set(o._id, o);
  return o;
}
export async function acceptOffer(offerId: string): Promise<Offer> {
  const o = offers.get(offerId);
  if (!o) throw new Error("no such offer");
  const a = { ...o, status: "accepted" as const };
  offers.set(offerId, a);
  return a;
}
