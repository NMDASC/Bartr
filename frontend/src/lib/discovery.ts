/** GraphQL discovery transport. Trading continues through the existing API adapter. */
import type { CompanyCard, DiscoveryEvent, Relevance, SearchIntent } from "@contracts/types";

interface Job { id: string; intent: SearchIntent; status: string; warnings: string[]; revision: number }
interface Page { hits: { company: CompanyCard; relevance: Relevance }[]; total: number; revision: number }

const INTENT = `category naics_guess: naicsGuess state city min_value: minValue max_value: maxValue must_have: mustHave`;
const CARD = `_id: id name category city state rating review_count: reviewCount bid ask last v0_per_share: v0PerShare confidence status`;
const RANK = `rank score semantic keyword preference evidence matched unknown version semantic_method: semanticMethod`;

export function streamGraphqlSearch(base: string, q: string, onEvent: (event: DiscoveryEvent) => void): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  async function query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${base}/graphql`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }), signal: controller.signal,
    });
    if (!response.ok) throw new Error("Search is unavailable. Please retry.");
    const body = await response.json();
    if (body.errors?.length || !body.data) throw new Error("Search could not complete. Please retry.");
    return body.data as T;
  }
  async function start() {
    try {
      const created = await query<{ startDiscovery: Job }>(`mutation($input: DiscoveryInput!) {
        startDiscovery(input: $input) { id intent { ${INTENT} } status warnings revision }
      }`, { input: { q, limit: 50 } });
      if (stopped) return;
      const id = created.startDiscovery.id;
      onEvent({ type: "intent", intent: created.startDiscovery.intent });
      let revision = -1;
      async function poll() {
        if (stopped) return;
        try {
          const data = await query<{ discoveryJob: Job; searchResults: Page }>(`query($id: ID!) {
            discoveryJob(id: $id) { id status warnings revision intent { ${INTENT} } }
            searchResults(jobId: $id, first: 50) { total revision hits { company { ${CARD} } relevance { ${RANK} } } }
          }`, { id });
          if (stopped) return;
          onEvent({ type: "intent", intent: data.discoveryJob.intent });
          if (revision !== data.searchResults.revision) {
            revision = data.searchResults.revision;
            onEvent({ type: "ranking", revision, companies: data.searchResults.hits.map(h => ({ ...h.company, relevance: h.relevance })) });
          }
          if (data.discoveryJob.status !== "running") {
            if (data.discoveryJob.status === "failed") onEvent({ type: "error", message: "Search could not complete. Please retry." });
            onEvent({ type: "done", total: data.searchResults.total, warnings: data.discoveryJob.warnings, status: data.discoveryJob.status });
          } else timer = setTimeout(poll, 600);
        } catch (error) {
          if (!stopped) onEvent({ type: "error", message: error instanceof Error ? error.message : "Search failed" });
        }
      }
      await poll();
    } catch (error) {
      if (!stopped) onEvent({ type: "error", message: error instanceof Error ? error.message : "Search failed" });
    }
  }
  void start();
  return () => { stopped = true; controller.abort(); clearTimeout(timer); };
}
