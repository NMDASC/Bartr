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

export function setDemoUser(value: string) {
  window.localStorage.setItem("bartr:user", value.trim());
}

export async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(init?.method === "POST" ? 180000 : 20000),
    headers: {
      "content-type": "application/json",
      "x-demo-user": demoUser(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  }).catch((error: Error) => {
    if (error.name === "TimeoutError") throw new Error("Request timed out. Refresh to check its status before trying again.");
    throw error;
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${res.status}). Please try again.`);
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
export function streamSearch(q: string, onEvent: (e: DiscoveryEvent) => void): () => void {
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
  timer = setTimeout(() => fail("Search timed out. Try again."), 15000);
  (async () => {
    try {
      const { job_id, intent } = await j<SearchJobAccepted>("/discovery/search", {
        method: "POST", body: JSON.stringify({ q, limit: 50 }), signal: controller.signal,
      });
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
  return j<Batch[]>(`/markets/${id}/batches?limit=${limit}&all=true`);
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
export function subscribeMarket(id: string, onFrame: (f: MarketFrame) => void, onStatus?: (connected:boolean)=>void): () => void {
  if (IS_MOCK) { onStatus?.(true); return mock.subscribeMarket(id, onFrame); }
  let ws: WebSocket | null = null;
  let closed = false;
  let retries = 0;
  let timer: ReturnType<typeof setTimeout>;
  const connect = () => {
    if (closed) return;
    ws = new WebSocket(`${API_URL!.replace(/^http/, "ws")}/ws/markets/${encodeURIComponent(id)}`);
    ws.onopen = () => { retries = 0; onStatus?.(true); };
    ws.onmessage = m => { try { const frame = JSON.parse(m.data); if (["book","batch","flag"].includes(frame.type)) onFrame(frame); } catch { onStatus?.(false); } };
    ws.onerror = () => { onStatus?.(false); ws?.close(); };
    ws.onclose = () => { onStatus?.(false); if (!closed) timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retries++)); };
  };
  connect();
  return () => { closed=true; clearTimeout(timer); ws?.close(); };
}

// ---------------------------------------------------------------- portfolio / acquire / surveillance

export async function getPortfolio() {
  if (IS_MOCK) {
    const [portfolio, orders] = await Promise.all([mock.getPortfolio(), mock.myOrders()]);
    return {...portfolio, reserved_cash: orders.filter(o=>o.side==="buy"&&(o.status==="open"||o.status==="partial")).reduce((sum,o)=>sum+(o.qty-o.filled_qty)*o.limit_price,0)};
  }
  return j<Portfolio>("/portfolio");
}

export async function suggestPortfolio() {
  if (IS_MOCK) return mock.suggest();
  return j<Suggestion[]>("/portfolio/suggest", { method: "POST", body: "{}" });
}

export async function startAcquisition(companyId: string) {
  if (IS_MOCK) throw new Error("Connect the API to prepare and save acquisition drafts.");
  return j<Acquisition>(`/acquire/${companyId}/start`, { method: "POST", body: "{}" });
}

export async function getFlags() {
  if (IS_MOCK) return mock.flags();
  return j<Flag[]>("/surveillance/flags");
}

export async function getMyOrders(id: string): Promise<Order[]> {
  if (IS_MOCK) return mock.myOrders(id);
  return j<Order[]>(`/markets/${encodeURIComponent(id)}/orders/mine`);
}
export async function cancelOrder(id: string): Promise<Order> {
  if (IS_MOCK) return mock.cancelOrder(id);
  return j<Order>(`/markets/orders/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function getTrades(id: string): Promise<import("@contracts/types").Trade[]> {
  if (IS_MOCK) return [];
  return j(`/markets/${encodeURIComponent(id)}/trades?limit=50`);
}
export async function getOverview(): Promise<import("@contracts/types").Overview> {
  if (IS_MOCK) {
    const portfolio = await mock.getPortfolio();
    const orders = await mock.myOrders();
    const companies = await mock.listCompanies({});
    return { user_id: demoUser(), display_name: demoUser(), portfolio, orders: orders.map(o=>({...o,company_name:companies.find(c=>c._id===o.market_id)?.name??o.market_id,category:"business"})), activity: [], open_orders: orders.filter(o=>o.status==="open"||o.status==="partial").length, reserved_cash: orders.filter(o=>o.side==="buy"&&(o.status==="open"||o.status==="partial")).reduce((s,o)=>s+(o.qty-o.filled_qty)*o.limit_price,0), as_of:new Date().toISOString() };
  }
  return j("/portfolio/overview");
}
export async function getChannel(): Promise<import("@contracts/types").ChannelStatus> {
  if (IS_MOCK) return { configured:false, connected:false, phone_number:null, last_seen:null, identity:demoUser(), identity_kind:"name" };
  return j("/agent/channel");
}
export async function getMessages(): Promise<(import("@contracts/types").AgentMessage & {channel?: string; t?: string})[]> {
  if (IS_MOCK) return [];
  return j("/agent/messages");
}
export async function askAgent(message: string) {
  if (IS_MOCK) return {role:"assistant" as const,content:"Connect the API to use the trading assistant. You can explore businesses and trade in the local exchange."};
  return j<import("@contracts/types").AgentMessage>("/agent/chat", {method:"POST",body:JSON.stringify({session_id:demoUser(),message})});
}
export async function getSecurity(token: string) {
  if (IS_MOCK) throw new Error("Connect the API to open the security console.");
  return j<import("@contracts/types").SecurityOverview>("/security/overview", {headers:{"x-admin-token":token}});
}
export async function getCase(token:string,id:string) {return j<import("@contracts/types").CaseDetail>(`/security/cases/${encodeURIComponent(id)}`,{headers:{"x-admin-token":token}});}
export async function reviewCase(token:string,id:string,status:import("@contracts/types").CaseStatus,note:string) {return j<import("@contracts/types").SecurityCase>(`/security/cases/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"x-admin-token":token},body:JSON.stringify({status,note})});}
export async function reviewAgents(token:string) {return j<{reviewed:number;remaining:number}>("/security/review",{method:"POST",headers:{"x-admin-token":token}});}
export async function getSecurityUser(token:string,id:string) { return j<import("@contracts/types").SecurityUser>(`/security/users/${encodeURIComponent(id)}`,{headers:{"x-admin-token":token}}); }
export async function getAcquisitionDraft(id:string):Promise<Acquisition|null>{if(IS_MOCK)return null;return j(`/acquire/${encodeURIComponent(id)}/draft`);}
export async function saveAcquisitionDraft(id:string,acq:Acquisition):Promise<Acquisition>{if(IS_MOCK)throw new Error("Connect the API to save acquisition drafts.");return j(`/acquire/${encodeURIComponent(id)}/draft`,{method:"PUT",body:JSON.stringify({loi_md:acq.loi_md,checklist:acq.checklist,checklist_source:acq.checklist_source})});}

export async function getSecurityEvents(token: string, options: { kind: "agents" | "audit"; query?: string; before?: number; offset?: number }) {
  const params = new URLSearchParams(Object.entries(options).filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)]));
  return j<import("@contracts/types").SecurityEventPage>(`/security/events?${params}`, {headers:{"x-admin-token":token}});
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
