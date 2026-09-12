/**
 * Data layer. One switch:
 *   NEXT_PUBLIC_API_URL unset  -> mock mode, fixtures from packages/contracts/examples + a local
 *                                 batch-auction simulator (src/lib/mock.ts)
 *   NEXT_PUBLIC_API_URL set    -> real FastAPI at {url}/api/v1 (contract in packages/contracts)
 *
 * Every screen imports from here and nowhere else, so the swap on Saturday morning is one env var.
 */

import type {
  Batch,
  Book,
  Company,
  CompanyCard,
  DiscoveryEvent,
  SearchJobAccepted,
  Order,
  Portfolio,
  Side,
  Suggestion,
  Flag,
  Acquisition,
  Offer,
  OfferIn,
} from "@contracts/types";
import * as mock from "./mock";

export const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") || null;
export const IS_MOCK = API_URL === null;
const BASE = `${API_URL}/api/v1`;
const CACHED_DEMO_EMAIL = "hackcmu@gmail.com";

function isCachedDemoUser(userId?: string) {
  return userId?.trim().toLowerCase() === CACHED_DEMO_EMAIL;
}

function isCachedPittsburghLaundrySearch(q: string, userId?: string) {
  const normalized = q.toLowerCase().replace(/[^a-z]+/g, " ").trim();
  return isCachedDemoUser(userId) && normalized.includes("pittsburgh") && /\blaundr(?:y|omat)s?\b/.test(normalized);
}

/** Demo auth: judges trade from phones without logging in. Matches Plan.md section 7. */
export function demoUser(): string {
  if (typeof window === "undefined") return "server";
  let u = window.localStorage.getItem("bartr:user");
  if (!u) {
    u = `guest-${Math.random().toString(36).slice(2, 6)}`;
    window.localStorage.setItem("bartr:user", u);
  }
  return u;
}

async function j<T>(path: string, init?: RequestInit, userId?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-demo-user": userId || demoUser(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = typeof body?.detail === "string" ? body.detail : `${init?.method ?? "GET"} ${path} -> ${res.status}`;
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------- discovery

export async function listCompanies(params: { q?: string; state?: string; category?: string } = {}) {
  if (IS_MOCK) return mock.listCompanies(params);
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  return j<CompanyCard[]>(`/companies?${qs}`);
}

export async function getCompany(id: string): Promise<Company | null> {
  if (IS_MOCK) return mock.getCompany(id);
  try {
    return await j<Company>(`/companies/${id}`);
  } catch {
    return null;
  }
}

/**
 * Streams a discovery job. Resolves when `done` arrives. Returns an abort function.
 * Real mode: POST /discovery/search then SSE on /discovery/jobs/{id}.
 */
export function streamSearch(
  q: string,
  onEvent: (e: DiscoveryEvent) => void,
  userId?: string,
): () => void {
  if (isCachedPittsburghLaundrySearch(q, userId)) {
    return mock.streamSearch(q, onEvent, { cached: true });
  }
  if (IS_MOCK) return mock.streamSearch(q, onEvent);

  let es: EventSource | null = null;
  const controller = new AbortController();
  let stopped = false;
  let reconnects = 0;
  let timer: ReturnType<typeof setTimeout>;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    controller.abort();
    es?.close();
  };
  const fail = (message: string) => {
    if (stopped) return;
    onEvent({ type: "error", message });
    stop();
  };
  timer = setTimeout(() => fail("Search timed out. Try again."), 60000);
  (async () => {
    try {
      const { job_id, intent } = await j<SearchJobAccepted>(
        "/discovery/search",
        { method: "POST", body: JSON.stringify({ q, limit: 50 }), signal: controller.signal },
        userId,
      );
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(() => fail("Search timed out. Try again."), 210000);
      onEvent({ type: "intent", intent });
      es = new EventSource(`${BASE}/discovery/jobs/${encodeURIComponent(job_id)}`);
      es.onmessage = (m) => {
        if (stopped) return;
        try {
          const event = JSON.parse(m.data) as DiscoveryEvent;
          reconnects = 0;
          onEvent(event);
          if (event.type === "done" || event.type === "error") stop();
        } catch {
          fail("Search returned an invalid response. Try again.");
        }
      };
      es.onerror = () => {
        // EventSource reconnects with Last-Event-ID; the server replays the same job.
        if (es?.readyState === EventSource.CLOSED || ++reconnects >= 3) {
          fail("Search connection lost. Try again.");
        }
      };
    } catch {
      fail("Search is unavailable. Try again.");
    }
  })();
  return stop;
}

// ---------------------------------------------------------------- market

export async function getBook(id: string) {
  if (IS_MOCK) return mock.getBook(id);
  return j<Book>(`/markets/${id}/book`);
}

export async function getBatches(id: string, limit = 60) {
  if (IS_MOCK) return mock.getBatches(id, limit);
  return j<Batch[]>(`/markets/${id}/batches?limit=${limit}`);
}

export async function placeOrder(id: string, o: { side: Side; qty: number; limit_price: number }) {
  if (IS_MOCK) return mock.placeOrder(id, o);
  return j<Order>(`/markets/${id}/orders`, { method: "POST", body: JSON.stringify(o) });
}

export async function getMyOrders(id: string) {
  if (IS_MOCK) return mock.getMyOrders(id);
  return j<Order[]>(`/markets/${id}/orders/mine`);
}

export type MarketFrame =
  | { type: "book"; book: Book }
  | { type: "batch"; batch: Batch }
  | { type: "flag"; flag: Flag };

/** Subscribes to a market. Returns unsubscribe. Real mode uses WS /ws/markets/{id}. */
export function subscribeMarket(id: string, onFrame: (f: MarketFrame) => void): () => void {
  if (IS_MOCK) return mock.subscribeMarket(id, onFrame);
  const wsUrl = `${API_URL!.replace(/^http/, "ws")}/ws/markets/${id}`;
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (m) => onFrame(JSON.parse(m.data) as MarketFrame);
  return () => ws.close();
}

// ---------------------------------------------------------------- portfolio / acquire / surveillance

export async function getPortfolio(userId?: string) {
  if (IS_MOCK || isCachedDemoUser(userId)) return mock.getPortfolio(userId);
  return j<Portfolio>("/portfolio", undefined, userId);
}

export async function suggestPortfolio(userId?: string) {
  if (IS_MOCK || isCachedDemoUser(userId)) return mock.suggest(userId);
  return j<Suggestion[]>("/portfolio/suggest", { method: "POST", body: "{}" }, userId);
}

export async function startAcquisition(companyId: string, buyerName?: string) {
  if (IS_MOCK) return mock.acquire(companyId);
  return j<Acquisition>(`/acquire/${companyId}/start`, { method: "POST", body: JSON.stringify(buyerName ? { buyer_name: buyerName } : {}) });
}

export async function getFlags() {
  if (IS_MOCK) return mock.flags();
  const res = await fetch("/api/admin/surveillance", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/admin/surveillance -> ${res.status}`);
  return res.json() as Promise<Flag[]>;
}

// ---------------------------------------------------------------- offers (discovered businesses)

export async function makeOffer(companyId: string, body: OfferIn): Promise<Offer> {
  if (IS_MOCK) return mock.makeOffer(companyId, body);
  return j<Offer>(`/companies/${companyId}/offer`, { method: "POST", body: JSON.stringify(body) });
}

export async function acceptOffer(offerId: string): Promise<Offer> {
  if (IS_MOCK) return mock.acceptOffer(offerId);
  return j<Offer>(`/offers/${offerId}/accept`, { method: "POST", body: "{}" });
}
