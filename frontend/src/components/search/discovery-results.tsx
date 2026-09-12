"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useState } from "react";
import { ArrowUpRight, Building2, MapPin, Star } from "lucide-react";

import type { CompanyCard } from "@contracts/types";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchProgress } from "@/components/search/search-progress";
import { streamSearch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { pct, px, usd } from "@/lib/format";
import { clearSavedSearch, initialSearchState, readSavedSearch, reduceDiscovery, writeSavedSearch } from "@/lib/search-state";

type Sort = "recommended" | "value" | "name";

function confidenceMeta(confidence: number | null) {
  if (confidence === null) {
    return {
      label: "Researching",
      tone: "accent" as const,
      border: "border-l-accent",
      bar: "bg-accent",
      text: "text-accent",
    };
  }
  if (confidence >= 0.65) {
    return {
      label: "Strong profile",
      tone: "up" as const,
      border: "border-l-up",
      bar: "bg-up",
      text: "text-up",
    };
  }
  if (confidence < 0.5) {
    return {
      label: "Limited data",
      tone: "down" as const,
      border: "border-l-down",
      bar: "bg-down",
      text: "text-down",
    };
  }
  return {
    label: "Developing profile",
    tone: "accent" as const,
    border: "border-l-accent",
    bar: "bg-accent",
    text: "text-accent",
  };
}

function companyValue(company: CompanyCard) {
  return company.v0_per_share === null ? null : company.v0_per_share * 10_000;
}

export function DiscoveryResults({
  q,
  userId,
  cached = false,
}: {
  q: string;
  userId?: string;
  cached?: boolean;
}) {
  const [search, dispatch] = useReducer(reduceDiscovery, undefined, initialSearchState);
  const { phase, intent, cards, order, error, warnings, activity, hydrated, restored, jobId } = search;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState("");
  const [band, setBand] = useState("");
  const [sort, setSort] = useState<Sort>("recommended");

  // Back from a company brief remounts this. A finished search comes out of the
  // session cache, so the progress stage runs once per search, not once per visit.
  useEffect(() => {
    if (!q) return;
    const saved = readSavedSearch(q, userId);
    dispatch(saved ? { type: "restore", state: saved } : { type: "nocache" });
  }, [q, userId]);

  useEffect(() => {
    if (!q || !hydrated || restored) return;
    const stop = streamSearch(q, dispatch, userId, {
      jobId,
      onJob: (id) => dispatch({ type: "job", jobId: id }),
    });
    return stop;
    // jobId is read once when the stream starts; a later job event must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, attempt, userId, hydrated, restored]);

  // Saved while running too, so Back mid-search reattaches to the same job with the
  // cards it already had instead of posting a new search.
  useEffect(() => {
    if (!q || restored || !hydrated || phase === "error") return;
    writeSavedSearch(q, userId, search);
  }, [q, userId, phase, restored, hydrated, search]);

  const rows = useMemo(() => {
    const filtered = order
      .map((id) => cards.get(id))
      .filter((company): company is CompanyCard => Boolean(company))
      .filter((company) => {
        if (state && company.state !== state) return false;
        const value = companyValue(company);
        if (band && value === null) return false;
        if (band === "lt500" && value !== null && value >= 500_000) return false;
        if (band === "500-1500" && value !== null && (value < 500_000 || value > 1_500_000)) return false;
        if (band === "gt1500" && value !== null && value <= 1_500_000) return false;
        return true;
      });

    return [...filtered].sort((a, b) => {
      if (a.status !== b.status) return a.status === "ready" ? -1 : 1;
      if (sort === "recommended") {
        const confidence = (b.confidence ?? -1) - (a.confidence ?? -1);
        if (confidence !== 0) return confidence;
        return (a.relevance?.rank ?? order.indexOf(a._id)) - (b.relevance?.rank ?? order.indexOf(b._id));
      }
      if (sort === "value") return (companyValue(b) ?? 0) - (companyValue(a) ?? 0);
      return a.name.localeCompare(b.name);
    });
  }, [band, cards, order, sort, state]);

  const states = useMemo(
    () =>
      Array.from(
        new Set(order.map((id) => cards.get(id)?.state).filter((value): value is string => Boolean(value))),
      ),
    [cards, order],
  );

  if (!q) return null;

  const searching = phase === "streaming";
  const readyCount = rows.filter((company) => company.status === "ready").length;

  return (
    <section className={cn("pb-20", !cached && "border-t border-line pt-10")}>
      {searching && hydrated ? (
        <SearchProgress
          q={q}
          intent={intent}
          activity={activity}
          found={readyCount}
          cached={cached}
        />
      ) : null}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <Label className="mb-2 block">{cached ? "Cached matches" : "Search results"}</Label>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[28px] leading-none md:text-[36px]">{q}</h2>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {readyCount} priced
            </span>
          </div>
        </div>
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.1em]",
            phase === "done" ? "text-up" : phase === "error" ? "text-down" : "text-accent",
          )}
          role="status"
          aria-live="polite"
        >
          {phase === "error"
            ? "Unavailable"
            : phase === "partial"
              ? "Best available"
              : phase === "done"
                ? "Research complete"
                : "Searching"}
        </span>
      </div>

      <div className="mb-7 grid gap-px bg-line sm:grid-cols-3">
        <label className="bg-card p-3">
          <Label as="span" tracking="tight" className="mb-1.5 block">State</Label>
          <Select value={state} onChange={(event) => setState(event.target.value)} aria-label="State" className="bg-background">
            <option value="">All states</option>
            {states.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </label>
        <label className="bg-card p-3">
          <Label as="span" tracking="tight" className="mb-1.5 block">Business value</Label>
          <Select value={band} onChange={(event) => setBand(event.target.value)} aria-label="Business value" className="bg-background">
            <option value="">Any value</option>
            <option value="lt500">Under $500K</option>
            <option value="500-1500">$500K to $1.5M</option>
            <option value="gt1500">Over $1.5M</option>
          </Select>
        </label>
        <label className="bg-card p-3">
          <Label as="span" tracking="tight" className="mb-1.5 block">Order by</Label>
          <Select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Order results" className="bg-background">
            <option value="recommended">Highest confidence</option>
            <option value="value">Highest value</option>
            <option value="name">Company name</option>
          </Select>
        </label>
      </div>

      {error ? <p role="alert" className="mb-4 border-l-2 border-down bg-down/[0.05] px-4 py-3 text-down">{error}</p> : null}
      {warnings.length ? (
        <ul className="mb-4 text-[13px] text-muted-foreground">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      {phase === "error" || phase === "partial" ? (
        <Button
          size="sm"
          className="mb-5"
          onClick={() => {
            clearSavedSearch(q, userId);
            dispatch({ type: "reset" });
            setAttempt((value) => value + 1);
          }}
        >
          Refresh research
        </Button>
      ) : null}

      <ol className="grid gap-4">
        {rows.map((company, index) => {
          const meta = confidenceMeta(company.confidence);
          const value = companyValue(company);
          return (
            <li
              key={company._id}
              className={cn(
                "bl-arrive group border border-l-4 border-line bg-card transition-colors duration-150 hover:bg-white",
                meta.border,
              )}
              style={{ animationDelay: `${Math.min(index * 80, 320)}ms` }}
            >
              <Link href={`/company/${company._id}`} className="block p-5 md:p-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                      {cached ? <Chip tone="neutral">Cached</Chip> : null}
                      {company.listed === false ? <Chip tone="neutral">Private</Chip> : null}
                    </div>

                    <div className="flex items-start gap-4">
                      <span className="hidden size-10 shrink-0 items-center justify-center bg-surface text-primary sm:flex">
                        <Building2 className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[23px] leading-[1.12] transition-colors group-hover:text-accent-deep md:text-[28px]">
                          {company.name}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="size-3" />
                            {[company.city, company.state].filter(Boolean).join(", ")}
                          </span>
                          <span>{company.category.replaceAll("_", " ")}</span>
                          {company.rating !== null ? (
                            <span className="flex items-center gap-1.5">
                              <Star className="size-3 fill-current text-accent" />
                              {company.rating.toFixed(1)} ({company.review_count})
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <dl className="mt-6 grid grid-cols-2 gap-px bg-hairline sm:grid-cols-4">
                      <div className="bg-background p-3">
                        <dt><Label tracking="tight">Estimated value</Label></dt>
                        <dd className="mt-1 font-mono text-[16px] tabular-nums">
                          {value !== null ? usd(value, { compact: true }) : <Skeleton className="mt-1 h-4 w-16" />}
                        </dd>
                      </div>
                      <div className="bg-background p-3">
                        <dt><Label tracking="tight">Bid</Label></dt>
                        <dd className="mt-1 font-mono text-[16px] tabular-nums text-up">{px(company.bid)}</dd>
                      </div>
                      <div className="bg-background p-3">
                        <dt><Label tracking="tight">Ask</Label></dt>
                        <dd className="mt-1 font-mono text-[16px] tabular-nums text-down">{px(company.ask)}</dd>
                      </div>
                      <div className="bg-background p-3">
                        <dt><Label tracking="tight">Last</Label></dt>
                        <dd className="mt-1 font-mono text-[16px] tabular-nums">{px(company.last)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-col justify-between border-t border-hairline pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <div>
                      <Label tracking="tight" className="mb-2 block">Research confidence</Label>
                      <div className={cn("font-mono text-[34px] tabular-nums", meta.text)}>
                        {company.confidence !== null ? pct(company.confidence) : "Scanning"}
                      </div>
                      <div className="mt-3 h-1 bg-tint-300">
                        <div
                          className={cn("h-full transition-[width] duration-500", meta.bar)}
                          style={{ width: `${(company.confidence ?? 0.12) * 100}%` }}
                        />
                      </div>
                      <p className="mt-3 text-[12px] text-muted-foreground">
                        {company.confidence === null
                          ? "Records are still being checked."
                          : company.confidence < 0.5
                            ? "Stale or incomplete operating data."
                            : "Financial and ownership records available."}
                      </p>
                    </div>
                    <span className="mt-6 flex items-center justify-between border-t border-hairline pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep">
                      Open company
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      {(phase === "done" || phase === "partial") && rows.length === 0 ? (
        <div className="border border-line bg-card px-5 py-12 text-center">
          <Label className="mb-2 block">No matches</Label>
          <p className="text-[16px] text-muted-foreground">Try another market or business type.</p>
        </div>
      ) : null}
    </section>
  );
}
