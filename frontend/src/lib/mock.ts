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
const ledger: Order[] = [];
const localPortfolio = structuredClone(portfolioFixture) as unknown as Portfolio;
const SHARES = 10000;
const INTERVAL_S = 10;
const FLOAT = 3000; // owner offers 30% at listing
const FLOOR_QTY = 1000; // owner buys back up to 10% at the floor
const S_M = 0.1; // observation noise of a clearing price, log space
const FEE = 0.005;
const Z = { p20: -0.8416, ladder: [0.1257, 0.2859, 0.4538, 0.6356, 0.8416] }; // z(0.20), z(0.55..0.80)

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
    market: {
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

export function streamSearch(q: string, onEvent: (e: DiscoveryEvent) => void): () => void {
  const timers: number[] = [];
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  const place = q.match(/\b(?:in|near|around)\s+(.+?)(?=\s+(?:under|over|with|below|above|for)\b|$)/i)?.[1];
  const city = place?.split(",")[0].trim() ?? null;
  const state = place?.match(/,\s*([a-z]{2})\b/i)?.[1].toUpperCase() ?? (/\bpittsburgh\b/i.test(q) ? "PA" : null);
  const category = /laundromat|laundry/i.test(q) ? "laundromat" : /car wash|carwash/i.test(q) ? "car_wash" : /machine shop/i.test(q) ? "machine_shop" : /restaurant/i.test(q) ? "restaurant" : "default";
  const amount = q.match(/\b(?:under|below)\s*\$?([\d,.]+)\s*(k|m|million|thousand)?\b/i);
  const maxValue = amount ? Number(amount[1].replaceAll(",", "")) * (/^(m|million)$/i.test(amount[2] ?? "") ? 1e6 : /^(k|thousand)$/i.test(amount[2] ?? "") ? 1e3 : 1) : null;
  const intent: SearchIntent = { category, naics_guess: null, state, city, min_value: null, max_value: maxValue, must_have: [] };
  const matches = CARDS.filter(c => (!city || c.city?.toLowerCase() === city.toLowerCase()) && (!state || c.state === state)
    && (category === "default" || c.category === category) && (maxValue === null || c.v0_per_share !== null && c.v0_per_share * SHARES <= maxValue));
  at(250, () => onEvent({ type: "intent", intent }));
  at(400, () => onEvent({ type: "ranking", revision: 1, companies: matches }));
  matches.forEach((c, i) => {
    const stub: CompanyCard = { ...c, bid: null, ask: null, last: null, v0_per_share: null, confidence: null, status: "stub" };
    at(600 + i * 350, () => onEvent({ type: "company_stub", company: stub }));
    if (c.status === "ready") at(2200 + i * 900, () => onEvent({ type: "company_ready", company: c }));
  });
  at(2200 + matches.length * 900 + 400, () => onEvent({ type: "done", total: matches.length, warnings: ["Live search unavailable"], status: "partial" }));
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
    sumLnP: batches.reduce((a, b) => a + Math.log((b.clearing_price ?? p) * SHARES), 0),
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
  const humans=m.orders.filter(o=>o.user==="you");
  m.orders=[...m.orders.filter(o=>o.user!=="you").slice(-14),...humans];

  const book = buildBook(m);
  const { p, vol, imb } = clear(book.bids, book.asks, m.last);
  // band clamp
  const lo = book.band.low;
  const hi = book.band.high;
  const px = Math.min(hi, Math.max(lo, p));

  const filled = vol > 0 ? m.orders.filter((o) => (o.side === "buy" ? o.limit >= px : o.limit <= px)) : [];
  for (const side of ["buy", "sell"] as Side[]) {
    let remaining = vol;
    const eligible = filled.filter(o=>o.side===side);
    const total=eligible.reduce((sum,o)=>sum+o.qty,0);
    for (const o of eligible) {
      const record=ledger.find(x=>x._id===o.id);
      const fill=Math.min(remaining, o.qty, total>vol ? Math.floor(o.qty/total*vol*100)/100 : o.qty);
      remaining=Math.max(0,remaining-fill);
      if (!record || fill<=0) continue;
      record.filled_qty=round2(record.filled_qty+fill);
      record.status=record.filled_qty>=record.qty-1e-8?"filled":"partial";
      let pos=localPortfolio.positions.find(p=>p.market_id===m.id);
      if (side==="buy") {
        if(!pos){pos={market_id:m.id,name:CARDS.find(c=>c._id===m.id)?.name??m.id,qty:0,avg_cost:0,last:px,value:0,pnl:0};localPortfolio.positions.push(pos);}
        pos.avg_cost=(pos.avg_cost*pos.qty+fill*px)/(pos.qty+fill);pos.qty+=fill;localPortfolio.cash-=fill*px;
      } else if(pos){localPortfolio.pnl.realized+=fill*(px-pos.avg_cost);pos.qty-=fill;localPortfolio.cash+=fill*px;}
      o.qty=round2(o.qty-fill);
    }
  }
  m.orders = m.orders.filter((o) => !filled.includes(o) || (o.user==="you" && o.qty>0));
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
  if (!Number.isFinite(o.qty) || !Number.isFinite(o.limit_price) || o.qty < .01 || o.qty > 500 || o.limit_price <= 0) throw new Error("Enter 0.01 to 500 shares and a positive price.");
  const reserved = ledger.filter(x=>x.side==="buy"&&(x.status==="open"||x.status==="partial")).reduce((sum,x)=>sum+(x.qty-x.filled_qty)*x.limit_price,0);
  if (o.side==="buy" && o.qty*o.limit_price > localPortfolio.cash-reserved) throw new Error("Not enough available cash.");
  const position=localPortfolio.positions.find(p=>p.market_id===id);
  if (o.side==="sell" && o.qty>(position?.qty??0)) throw new Error("Not enough shares.");
  const order: UserOrder = { id: `o_${Math.random().toString(36).slice(2, 8)}`, user: "you", side: o.side, qty: o.qty, limit: round2(o.limit_price), t: Date.now() };
  m.orders.push(order);
  const book = buildBook(m);
  for (const fn of m.subs) fn({ type: "book", book });
  const result:Order = {
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
  ledger.push(result);
  ensureRunning(m);
  return result;
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

export async function getPortfolio() {
  for(const p of localPortfolio.positions){const m=MARKETS.get(p.market_id);p.last=m?.last??p.last;p.value=p.qty*(p.last??p.avg_cost);p.pnl=p.value-p.qty*p.avg_cost;}
  localPortfolio.positions=localPortfolio.positions.filter(p=>p.qty>0);
  localPortfolio.pnl.unrealized=localPortfolio.positions.reduce((sum,p)=>sum+p.pnl,0);
  localPortfolio.pnl.total=localPortfolio.pnl.realized+localPortfolio.pnl.unrealized;
  return structuredClone(localPortfolio);
}
export async function suggest() {
  return suggestFixture as unknown as Suggestion[];
}
export async function flags() {
  return flagsFixture as unknown as Flag[];
}
export async function acquire(companyId: string) {
  return { ...(acquireFixture as unknown as Acquisition), market_id: companyId };
}

export async function myOrders(id?:string):Promise<Order[]> { return ledger.filter(o=>!id||o.market_id===id).map(o=>({...o})).reverse(); }
export async function cancelOrder(id:string):Promise<Order> {const o=ledger.find(o=>o._id===id);if(!o)throw new Error("Order not found");if(o.status==="open"||o.status==="partial"){o.status="cancelled";o.cancelled_at=new Date().toISOString();const m=market(o.market_id);m.orders=m.orders.filter(x=>x.id!==id);for(const fn of m.subs)fn({type:"book",book:buildBook(m)});}return {...o};}
