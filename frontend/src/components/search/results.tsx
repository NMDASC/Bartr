"use client";

import { MarketCard } from "@/components/dashboard/shared";
import { useEffect, useMemo, useReducer, useState } from "react";
import { streamSearch } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { initialSearchState, reduceDiscovery } from "@/lib/search-state";
import { Button } from "@/components/ui/button";

export function Results({ q }: { q: string }) {
  const [{ phase, cards, order, error, warnings, activity }, dispatch] = useReducer(reduceDiscovery, undefined, initialSearchState);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState("");
  const [band, setBand] = useState("");
  const [sort, setSort] = useState<"relevance" | "conf" | "value" | "name">("relevance");

  // page.tsx mounts this with key={q}, so a new query is a fresh component; no reset needed here
  useEffect(() => {
    if (!q) return;
    const stop = streamSearch(q, dispatch);
    return stop;
  }, [q, attempt]);

  const rows = useMemo(() => {
    const all = order.map((id) => cards.get(id)!).filter(Boolean);
    const filtered = all.filter((c) => {
      if (state && c.state !== state) return false;
      if (band) {
        if (c.v0_per_share === null) return false;
        const v = c.v0_per_share * 10000;
        if (band === "lt500" && v >= 500_000) return false;
        if (band === "500-1500" && (v < 500_000 || v > 1_500_000)) return false;
        if (band === "gt1500" && v <= 1_500_000) return false;
      }
      return true;
    });
    const ready = filtered.filter((c) => c.status === "ready");
    const stubs = filtered.filter((c) => c.status !== "ready");
    ready.sort((a, b) => {
      if (sort === "relevance") return (a.relevance?.rank ?? order.indexOf(a._id)) - (b.relevance?.rank ?? order.indexOf(b._id));
      if (sort === "conf") return (b.confidence ?? 0) - (a.confidence ?? 0);
      if (sort === "value") return (b.v0_per_share ?? 0) - (a.v0_per_share ?? 0);
      return a.name.localeCompare(b.name);
    });
    return [...ready, ...stubs];
  }, [cards, order, state, band, sort]);

  const states = useMemo(() => Array.from(new Set(order.map((id) => cards.get(id)?.state).filter(Boolean))) as string[], [cards, order]);
  const readyCount = rows.filter((c) => c.status === "ready").length;

  if (!q) {
    return null;
  }

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto"><h2 className="section-title">Your search results</h2><p className="mt-1 text-xs secondary">{q}</p></div>
        <Select className="!w-32 bg-white" value={state} onChange={e=>setState(e.target.value)} aria-label="Filter state"><option value="">All states</option>{states.map(s=><option key={s}>{s}</option>)}</Select>
        <Select className="!w-44 bg-white" value={band} onChange={e=>setBand(e.target.value)} aria-label="Filter business value"><option value="">Any business value</option><option value="lt500">Under $500K</option><option value="500-1500">$500K to $1.5M</option><option value="gt1500">Over $1.5M</option></Select>
        <Select className="!w-36 bg-white" value={sort} onChange={e=>setSort(e.target.value as typeof sort)} aria-label="Sort results"><option value="relevance">Best match</option><option value="conf">Confidence</option><option value="value">Highest value</option><option value="name">Name</option></Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3" role="status" aria-live="polite">
          <Label>
            {readyCount} priced{rows.length > readyCount ? ` · ${rows.length - readyCount} ${phase === "streaming" ? "reading" : "unavailable"}` : ""}
          </Label>
          <span className={cn("font-mono text-[10px] uppercase tracking-[0.1em]", phase === "done" ? "text-muted-foreground" : "text-accent")}>
            {phase === "error" ? "Unavailable" : phase === "partial" ? "Partial results" : phase === "done" ? "Complete" : "Searching"}
          </span>
        </div>

        {/* what the search is doing: the last few status lines from the pipeline, newest emphasized */}
        {activity.length ? (
          <ol className="mb-4 border-l border-line pl-3 flex flex-col gap-1" aria-label="Search activity">
            {activity.slice(-4).map((a, i, arr) => (
              <li key={`${a.t}-${i}`} className={cn("fade-up font-mono text-[11px] tracking-[0.02em]", i === arr.length - 1 && phase === "streaming" ? "text-foreground" : "text-muted-foreground")}>
                <span className="uppercase tracking-[0.1em] text-accent-deep mr-2">{a.phase}</span>
                {a.message}
                {i === arr.length - 1 && phase === "streaming" ? <span className="ml-1 inline-block w-[6px] h-[11px] align-[-1px] bg-accent animate-pulse" aria-hidden /> : null}
              </li>
            ))}
          </ol>
        ) : null}

        {error ? <p role="alert" className="py-4 text-down">{error}</p> : null}
        {warnings.length ? <ul className="py-3 text-[13px] secondary">{warnings.map(w => <li key={w}>{w}</li>)}</ul> : null}
        {phase === "error" || phase === "partial" ? <Button size="sm" className="mb-4" onClick={() => { dispatch({ type: "reset" }); setAttempt(a => a + 1); }}>Retry search</Button> : null}
        {(phase === "done" || phase === "partial") && rows.length === 0 ? <p className="py-4 secondary">{phase === "partial" ? "No saved matches." : "No matching companies."}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map(c=>c.status==="ready"?<MarketCard key={c._id} company={c}/>:<div key={c._id} className="dashboard-panel p-5"><Chip tone="accent">{phase==="streaming"?"Researching":"Unavailable"}</Chip><h3 className="mt-4 text-sm">{c.name}</h3><p className="mt-1 text-xs secondary">{c.city}, {c.state}</p>{phase==="streaming"&&<Skeleton className="mt-8 h-12 w-full"/>}</div>)}
          {phase==="streaming"&&!rows.length&&[0,1,2].map(i=><div key={i} className="dashboard-panel h-64 animate-pulse !bg-surface"/>)}
        </div>
      </div>
    </div>
  );
}
