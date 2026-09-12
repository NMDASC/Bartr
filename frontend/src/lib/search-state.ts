import type { CompanyCard, DiscoveryEvent, SearchIntent } from "@contracts/types";

export interface SearchState {
  phase: "streaming" | "done" | "partial" | "error";
  intent: SearchIntent | null;
  cards: Map<string, CompanyCard>;
  order: string[];
  error: string | null;
  warnings: string[];
  revision: number;
}

export function initialSearchState(): SearchState {
  return { phase: "streaming", intent: null, cards: new Map(), order: [], error: null, warnings: [], revision: -1 };
}

function finishCards(cards: Map<string, CompanyCard>) {
  return new Map([...cards].map(([id, company]) => [id, company.status === "stub" ? { ...company, status: "failed" as const } : company]));
}

export function reduceDiscovery(state: SearchState, event: DiscoveryEvent | { type: "reset" }): SearchState {
  switch (event.type) {
    case "reset": return initialSearchState();
    case "intent": return { ...state, intent: event.intent };
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
      const warnings = [...new Set([...state.warnings, ...(event.warnings ?? [])])];
      const incomplete = [...state.cards.values()].some(c => c.status !== "ready");
      const failed = event.status === "failed" || event.status === "cancelled" || state.phase === "error";
      return { ...state, warnings, cards: finishCards(state.cards),
        phase: failed ? "error" : warnings.length || incomplete || event.status === "partial" ? "partial" : "done",
        error: failed ? state.error ?? "Search could not complete. Try again." : null };
    }
  }
}
