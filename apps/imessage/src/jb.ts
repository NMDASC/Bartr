// JB API client for the bridge. One endpoint, transport agnostic (Plan.md 9.5).
// An unconfigured line reports its state without claiming an order was placed.

export type AgentReply = { content: string; tool_calls?: { name: string; args: Record<string, unknown>; result_count: number }[] };

export interface JbClient {
  chat(sessionId: string, message: string, requestId?: string): Promise<AgentReply>;
  mode: "live" | "offline";
}

export function jbClient(opts: { apiUrl?: string; bridgeToken?: string; log: (m: string) => void }): JbClient {
  const base = opts.apiUrl?.replace(/\/$/, "");
  if (!base) {
    opts.log("JB_API_URL unset, trading unavailable");
    return { mode: "offline", chat: async () => ({content: "This line is not connected to the exchange. No order has been placed. Configure JB_API_URL to enable trading."}) };
  }
  return {
    mode: "live",
    async chat(sessionId, message, requestId) {
      const res = await fetch(`${base}/api/v1/agent/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-demo-user": sessionId, ...(opts.bridgeToken ? {"x-bridge-token": opts.bridgeToken} : {}) },
        body: JSON.stringify({ session_id: sessionId, message, request_id: requestId }),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`agent/chat ${res.status}`);
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = (await res.json()) as AgentReply | { content?: string; reply?: string };
        return { content: (j as AgentReply).content ?? (j as { reply?: string }).reply ?? "", tool_calls: (j as AgentReply).tool_calls };
      }
      return { content: await res.text() };
    },
  };
}
