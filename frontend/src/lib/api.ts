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
  Order,
  Portfolio,
  Side,
  Suggestion,
  Flag,
  Acquisition,
} from "@contracts/types";
import * as mock from "./mock";

export const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? null;
export const IS_MOCK = API_URL === null;
const BASE = `${API_URL}/api/v1`;

/** Demo auth: judges trade from phones without logging in. Matches Plan.md section 7. */
export function demoUser(): string {
  if (typeof window === "undefined") return "server";
  let u = window.localStorage.getItem("jb:demo-user");
  if (!u) {
    u = `guest-${Math.random().toString(36).slice(2, 6)}`;
    window.localStorage.setItem("jb:demo-user", u);
  }
  return u;
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-demo-user": demoUser(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}`);
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
export function streamSearch(q: string, onEvent: (e: DiscoveryEvent) => void): () => void {
  if (IS_MOCK) return mock.streamSearch(q, onEvent);

  let es: EventSource | null = null;
  let aborted = false;
  (async () => {
    const { job_id, intent } = await j<{ job_id: string; intent: DiscoveryEvent extends { intent: infer I } ? I : never }>(
      "/discovery/search",
      { method: "POST", body: JSON.stringify({ q }) },
    );
    if (aborted) return;
    onEvent({ type: "intent", intent } as DiscoveryEvent);
    es = new EventSource(`${BASE}/discovery/jobs/${job_id}`);
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as DiscoveryEvent;
      onEvent(ev);
      if (ev.type === "done") es?.close();
    };
    es.onerror = () => es?.close();
  })();
  return () => {
    aborted = true;
    es?.close();
  };
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

export async function getPortfolio() {
  if (IS_MOCK) return mock.getPortfolio();
  return j<Portfolio>("/portfolio");
}

export async function suggestPortfolio() {
  if (IS_MOCK) return mock.suggest();
  return j<Suggestion[]>("/portfolio/suggest", { method: "POST", body: "{}" });
}

export async function startAcquisition(companyId: string) {
  if (IS_MOCK) return mock.acquire(companyId);
  return j<Acquisition>(`/acquire/${companyId}/start`, { method: "POST", body: "{}" });
}

export async function getFlags() {
  if (IS_MOCK) return mock.flags();
  return j<Flag[]>("/surveillance/flags");
}
