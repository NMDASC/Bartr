import type { CompanyCard, DiscoveryEvent, SearchIntent } from "@contracts/types";

export interface SearchState {
  phase: "streaming" | "done" | "partial" | "error";
  intent: SearchIntent | null;
  cards: Map<string, CompanyCard>;
  order: string[];
  error: string | null;
  warnings: string[];
  revision: number;
  /** most recent status lines from the search, newest last */
  activity: { phase: string; message: string; t: number }[];
  /** live discovery was off for this search (no model or search key); results are what we already had */
  liveOff: boolean;
  /** the session cache has been consulted; until then nothing streams and no progress shows */
  hydrated: boolean;
  /** results came back from the session cache, so this mount does not stream */
  restored: boolean;
  /** the API job behind this search, so a remount can reattach instead of starting over */
  jobId: string | null;
}

export function initialSearchState(): SearchState {
  return { phase: "streaming", intent: null, cards: new Map(), order: [], error: null, warnings: [], revision: -1, activity: [], liveOff: false, hydrated: false, restored: false, jobId: null };
}

export type SavedSearch = Omit<SearchState, "cards" | "hydrated" | "restored"> & { cards: [string, CompanyCard][] };

function savedKey(q: string, userId?: string) {
  return `bartr:search:${(userId ?? "guest").toLowerCase()}:${q.trim().toLowerCase()}`;
}

/** A finished search is kept for the session, so Back from a company brief lands on the results, not on the progress stage again. */
export function readSavedSearch(q: string, userId?: string): SearchState | null {
  try {
    const raw = window.sessionStorage.getItem(savedKey(q, userId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedSearch;
    // A search still running when the page was left reattaches to its job; a finished one is final.
    const running = saved.phase === "streaming";
    return { ...saved, jobId: saved.jobId ?? null, cards: new Map(saved.cards), hydrated: true, restored: !running };
  } catch {
    return null;
  }
}

export function writeSavedSearch(q: string, userId: string | undefined, state: SearchState) {
  try {
    const saved: SavedSearch = {
      phase: state.phase, intent: state.intent, order: state.order, error: state.error, warnings: state.warnings,
      revision: state.revision, activity: state.activity, liveOff: state.liveOff, cards: [...state.cards],
      jobId: state.jobId,
    };
    window.sessionStorage.setItem(savedKey(q, userId), JSON.stringify(saved));
  } catch {
    // storage is a convenience; the search still works without it
  }
}

export function clearSavedSearch(q: string, userId?: string) {
  try {
    window.sessionStorage.removeItem(savedKey(q, userId));
  } catch {
    // nothing to clear
  }
}

function finishCards(cards: Map<string, CompanyCard>) {
  return new Map([...cards].map(([id, company]) => [id, company.status === "stub" ? { ...company, status: "failed" as const } : company]));
}

export type LocalEvent = { type: "reset" } | { type: "restore"; state: SearchState } | { type: "nocache" } | { type: "job"; jobId: string };

export function reduceDiscovery(state: SearchState, event: DiscoveryEvent | LocalEvent): SearchState {
  switch (event.type) {
    case "reset": return { ...initialSearchState(), hydrated: true };
    case "restore": return event.state;
    case "nocache": return { ...state, hydrated: true };
    case "job": return { ...state, jobId: event.jobId };
    case "intent": return { ...state, intent: event.intent };
    case "status": return { ...state, activity: [...state.activity.slice(-7), { phase: event.phase, message: event.message, t: event.t }] };
    case "ranking":
      if (event.revision <= state.revision) return state;
      return { ...state, revision: event.revision, cards: new Map(event.companies.map(c => [c._id, c])), order: event.companies.map(c => c._id) };
    case "company_stub":
    case "company_ready": {
      const prior = state.cards.get(event.company._id);
      if (event.type === "company_stub" && prior?.status === "ready") return state;
      const company = { ...event.company, relevance: event.company.relevance ?? prior?.relevance };
      return { ...state, cards: new Map(state.cards).set(company._id, company), order: prior ? state.order : [...state.order, company._id] };
    }
    case "company_failed": {
      const company = state.cards.get(event.company_id);
      return { ...state, cards: company ? new Map(state.cards).set(event.company_id, { ...company, status: "failed" }) : state.cards,
        warnings: [...new Set([...state.warnings, "Some results were unavailable"])] };
    }
    case "error": return { ...state, phase: "error", error: event.message, cards: finishCards(state.cards) };
    case "done": {
      // An intentionally paused search is a mode, not a failure. A configured
      // live search that is unavailable is still partial and must remain visible.
      const OFF = new Set(["Live search is paused"]);
      const all = [...new Set([...state.warnings, ...(event.warnings ?? [])])];
      const warnings = all.filter((w) => !OFF.has(w));
      const liveOff = all.some((w) => OFF.has(w));
      const incomplete = [...state.cards.values()].some(c => c.status !== "ready");
      const failed = event.status === "failed" || event.status === "cancelled" || state.phase === "error";
      return { ...state, warnings, liveOff, cards: finishCards(state.cards),
        phase: failed ? "error" : warnings.length || incomplete || (event.status === "partial" && !liveOff) ? "partial" : "done",
        error: failed ? state.error ?? "Search could not complete. Try again." : null };
    }
  }
}
