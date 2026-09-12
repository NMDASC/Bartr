"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useState } from "react";
import { streamSearch } from "@/lib/api";
import { px, usd, pct } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { initialSearchState, reduceDiscovery } from "@/lib/search-state";
import { Button } from "@/components/ui/button";

export function Results({ q }: { q: string }) {
  const [{ phase, intent, cards, order, error, warnings, activity, liveOff }, dispatch] = useReducer(reduceDiscovery, undefined, initialSearchState);
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
    <div className="grid gap-8 lg:grid-cols-[220px_1fr] pb-20 border-t border-line pt-8">
      <aside aria-label="Filters" className="flex flex-col gap-6">
        <div>
          <Label className="mb-2 block">Query</Label>
          <p className="text-[16px]">{q}</p>
          {intent ? (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <dt className="uppercase tracking-[0.08em]">cat</dt>
              <dd className="text-foreground">{intent.category === "default" ? "any" : intent.category.replace(/_/g, " ")}</dd>
              <dt className="uppercase tracking-[0.08em]">naics</dt>
              <dd className="text-foreground">{intent.naics_guess ?? "\u2014"}</dd>
              <dt className="uppercase tracking-[0.08em]">state</dt>
              <dd className="text-foreground">{intent.state ?? "any"}</dd>
              <dt className="uppercase tracking-[0.08em]">city</dt>
              <dd className="text-foreground">{intent.city ?? "any"}</dd>
            </dl>
          ) : (
            <Skeleton className="mt-3 h-12 w-full" />
          )}
        </div>
        <div>
          <Label as="div" className="mb-2">State</Label>
          <Select value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
            <option value="">Any</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label as="div" className="mb-2">Value</Label>
          <Select value={band} onChange={(e) => setBand(e.target.value)} aria-label="Value band">
            <option value="">Any</option>
            <option value="lt500">Under $500K</option>
            <option value="500-1500">$500K to $1.5M</option>
            <option value="gt1500">Over $1.5M</option>
          </Select>
        </div>
        <div>
          <Label as="div" className="mb-2">Sort</Label>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="relevance">Relevance</option>
            <option value="conf">Confidence</option>
            <option value="value">Value</option>
            <option value="name">Name</option>
          </Select>
        </div>
      </aside>

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
        {warnings.length && rows.length === 0 ? (
          <ul className="py-3 text-[13px] secondary">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        {(phase === "error" || phase === "partial") && rows.length === 0 && !liveOff ? (
          <Button
            size="sm"
            className="mb-4"
            onClick={() => {
              dispatch({ type: "reset" });
              setAttempt((a) => a + 1);
            }}
          >
            Retry search
          </Button>
        ) : null}
        {liveOff && phase !== "streaming" ? (
          <p className="mb-3 text-[13px] secondary">
            Showing {readyCount} {readyCount === 1 ? "business" : "businesses"} already appraised{intent?.city ? ` in ${intent.city}` : intent?.state ? ` in ${intent.state}` : ""}. Live discovery is off until a model key is set.
          </p>
        ) : null}
        {(phase === "done" || phase === "partial") && rows.length === 0 ? <p className="py-4 secondary">{liveOff ? "Nothing appraised here yet." : phase === "partial" ? "No saved matches." : "No matching companies."}</p> : null}

        <div className="hidden md:grid grid-cols-[1fr_110px_110px_88px_120px] gap-4 px-3 pb-2 border-b border-line">
          <Label>Company</Label>
          <Label className="text-right">Value</Label>
          <Label className="text-right">Next clear</Label>
          <Label className="text-right">Last</Label>
          <Label>Confidence</Label>
        </div>

        <ul className="flex flex-col">
          {rows.map((c) => (
            <li key={c._id} className="fade-up border-b border-hairline">
              <Link
                href={`/company/${c._id}`}
                className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_110px_110px_88px_120px] items-center gap-x-4 gap-y-1 px-3 py-3.5 transition-colors duration-150 ease-out hover:bg-surface"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[16px]">{c.name}</span>
                    {c.status !== "ready" ? <Chip tone="accent">{c.status === "stub" && phase === "streaming" ? "Reading" : "Unavailable"}</Chip> : c.listed === false ? <Chip>Not listed</Chip> : null}
                  </div>
                  <div className="text-[13px] secondary">
                    {c.city}, {c.state} · {c.category}
                    {c.rating !== null ? ` · ${c.rating.toFixed(1)} (${c.review_count})` : ""}
                  </div>
                </div>
                <div className="font-mono text-[13px] tabular-nums text-right">
                  {c.v0_per_share !== null ? usd(c.v0_per_share * 10000, { compact: true }) : c.status === "stub" && phase === "streaming" ? <Skeleton className="inline-block h-3 w-14" /> : "—"}
                </div>
                {c.listed === false ? (
                  <div className="hidden md:block md:col-span-2 text-[12px] secondary text-right">
                    What we think it is worth · <span className="text-foreground">Make an offer</span>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block font-mono text-[13px] tabular-nums text-right text-accent-deep">{px(c.indicative_price ?? c.ask)}</div>
                    <div className="hidden md:block font-mono text-[13px] tabular-nums text-right">{px(c.last)}</div>
                  </>
                )}
                <div className="hidden md:flex items-center gap-2">
                  <div className="h-px flex-1 bg-tint-300 relative">
                    <div className="absolute inset-y-0 left-0 h-px bg-primary" style={{ width: `${(c.confidence ?? 0) * 100}%` }} />
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground w-8 text-right">{c.confidence !== null ? pct(c.confidence) : "\u2014"}</span>
                </div>
              </Link>
            </li>
          ))}
          {phase === "streaming" && rows.length === 0
            ? [0, 1, 2].map((i) => (
                <li key={i} className="border-b border-hairline px-3 py-3.5">
                  <Skeleton className="h-4 w-56 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </li>
              ))
            : null}
        </ul>
      </div>
    </div>
  );
}
