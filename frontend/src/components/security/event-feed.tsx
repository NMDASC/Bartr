"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ActivityEvent, AgentCall, SecurityEventPage } from "@contracts/types";
import { getSecurityEvents } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EmptyState, categoryName } from "@/components/dashboard/shared";

const stamp = (t: string) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Search reaches the stored archive; pagination stays anchored while new calls arrive. */
export function EventFeed({ token, kind, query, onCall, onAsset }: {
  token: string;
  kind: "agents" | "audit";
  query: string;
  onCall: (call: AgentCall) => void;
  onAsset: (id: string) => void;
}) {
  const generation = useRef(0);
  const [page, setPage] = useState<SecurityEventPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    generation.current += 1;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const next = await getSecurityEvents(token, { kind, query });
        if (active) { setPage(next); setError(""); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Records unavailable"); }
      finally { if (active) setBusy(false); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [token, kind, query, version]);

  async function older() {
    if (!page || page.next_offset === null) return;
    const requestGeneration = generation.current;
    setBusy(true);
    try {
      const next = await getSecurityEvents(token, { kind, query, before: page.before, offset: page.next_offset });
      if (requestGeneration !== generation.current) return;
      setPage(previous => previous ? { ...next, items: [...previous.items, ...next.items] } : next);
      setError("");
    } catch (e) { if (requestGeneration === generation.current) setError(e instanceof Error ? e.message : "Records unavailable"); }
    finally { if (requestGeneration === generation.current) setBusy(false); }
  }
  const items = page?.items ?? [];
  return <section className="dashboard-panel">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
      <span className="text-xs secondary">{query ? "Matching stored records" : "Full stored history"} · {items.length} loaded</span>
      <Button size="sm" disabled={busy} onClick={() => setVersion(v => v + 1)}><RefreshCw size={13} />Refresh records</Button>
    </div>
    {error && <p role="alert" className="p-4 text-xs text-down">{error}</p>}
    {kind === "agents" ? <div className="overflow-x-auto"><table className="data-table">
      <thead><tr><th>Agent / Model</th><th>Feature</th><th>Actor / Asset</th><th>Result</th><th>Latency</th><th>Time</th><th><span className="sr-only">Transcript</span></th></tr></thead>
      <tbody>{(items as AgentCall[]).map((call, i) => <tr key={call.id ?? i}>
        <td><span className="block font-medium">{call.payload.provider === "xai" ? "Grok" : call.payload.provider === "ifm" ? "K2" : call.payload.provider}</span><span className="mt-1 block font-mono text-[10px] secondary">{call.payload.model}</span></td>
        <td className="text-[10px]">{call.payload.feature}</td>
        <td><span className="block font-mono text-[10px]">{call.actor}</span>{call.market_id && <button className="text-[10px] text-accent" onClick={() => onAsset(call.market_id!)}>{call.market_id}</button>}</td>
        <td><span className={call.payload.status === "success" ? "text-up" : "text-down"}>{call.payload.status}</span></td>
        <td className="whitespace-nowrap font-mono">{call.payload.duration_ms} ms</td><td className="whitespace-nowrap secondary">{stamp(call.t)}</td>
        <td><button onClick={() => onCall(call)} className="whitespace-nowrap text-accent">Read transcript</button></td>
      </tr>)}</tbody>
    </table></div> : <div className="divide-y divide-hairline">{(items as ActivityEvent[]).map((event, i) => <details key={event.id ?? i} className="p-4">
      <summary className="cursor-pointer text-xs"><span className="mr-4 inline-block min-w-32 font-mono text-[10px] secondary">{stamp(event.t)}</span><span className="mr-4 text-accent">{categoryName(event.action)}</span><span className="font-mono text-[10px]">{event.actor}</span></summary>
      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 font-mono text-[10px] leading-5">{JSON.stringify(event, null, 2)}</pre>
    </details>)}</div>}
    {!items.length && !busy && <EmptyState title={query ? "No matching records" : "No records yet"} description={query ? "Try a user, market, model, or phrase from a response." : "Agent responses and exchange activity appear here as they happen."} />}
    {busy && <p role="status" className="p-4 text-center text-xs text-accent">Loading records…</p>}
    {page?.next_offset != null && <div className="border-t border-line p-4 text-center"><Button disabled={busy} onClick={older}>Load older records</Button></div>}
  </section>;
}
