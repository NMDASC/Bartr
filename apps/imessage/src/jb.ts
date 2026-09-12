// JB API client for the bridge. One endpoint, transport agnostic (Plan.md 9.5).
// If JB_API_URL is unset the bridge answers from a tiny canned script so the line
// can be demoed before the agent endpoint exists.

export type AgentReply = { content: string; tool_calls?: { name: string; args: Record<string, unknown>; result_count: number }[] };

export interface JbClient {
  chat(sessionId: string, message: string): Promise<AgentReply>;
  mode: "live" | "mock";
}

export function jbClient(opts: { apiUrl?: string; log: (m: string) => void }): JbClient {
  const base = opts.apiUrl?.replace(/\/$/, "");
  if (!base) {
    opts.log("JB_API_URL unset, running in mock mode");
    return { mode: "mock", chat: mockChat };
  }
  return {
    mode: "live",
    async chat(sessionId, message) {
      const res = await fetch(`${base}/api/v1/agent/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-demo-user": sessionId },
        body: JSON.stringify({ session_id: sessionId, message }),
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

// ---------------------------------------------------------------- mock

const turns = new Map<string, number>();

const script: AgentReply[] = [
  {
    content: [
      "Three in range.",
      "",
      "Suds City Coin Laundry, Tulsa. $1.04M, last $104.18/share. Confidence 71%.",
      "The Wash House, Bartlesville. $623K, last $61.00. Confidence 44%.",
      "Spin Zone, OKC. $1.73M, over your cap.",
      "",
      "Suds City is the cleanest read. Want the order book?",
    ].join("\n"),
  },
  {
    content: [
      "Placed. Buy 50 @ $104.00 limit on Suds City.",
      "",
      "Current bid $102.40, ask $106.10. Next batch clears in 6 seconds.",
      "You fill if the uniform price lands at or below $104.00.",
    ].join("\n"),
  },
  { content: "Filled 50 @ $103.95. You now hold 50 shares of Suds City, about 0.5% of the company." },
];

async function mockChat(sessionId: string, message: string): Promise<AgentReply> {
  await new Promise((r) => setTimeout(r, 600));
  const i = turns.get(sessionId) ?? 0;
  turns.set(sessionId, i + 1);
  if (/^\/?reset$/i.test(message.trim())) {
    turns.set(sessionId, 0);
    return { content: "Reset. Ask me for a business." };
  }
  return script[i] ?? { content: "That is the end of the mock script. Point JB_API_URL at the API for the real agent." };
}
