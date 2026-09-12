"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Suggestion } from "@contracts/types";
import { usd, px, pct } from "@/lib/format";
import { BusinessAvatar, categoryName } from "@/components/dashboard/shared";

/** Backend opportunities, sized against available cash and the existing Kelly caps. */
export function Suggestions({ initial, bankroll }: { initial: Suggestion[]; bankroll: number }) {
  const [multiplier, setMultiplier] = useState(.5);
  const rows = initial.map(suggestion => ({
    ...suggestion,
    fraction: Math.min(.2, Math.max(0, suggestion.sigma > 0 ? multiplier * suggestion.edge / suggestion.sigma ** 2 : 0)),
  }));
  const total = rows.reduce((sum, row) => sum + row.fraction, 0);
  const scale = total > .8 ? .8 / total : 1;
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-5">
      <div><h2 className="section-title">Suggested stakes</h2><p className="mt-1 text-xs secondary">Explore opportunities sized to your available cash.</p></div>
      <label className="flex flex-wrap items-center gap-3 text-xs secondary">
        Position size
        <input aria-label="Position size multiplier" type="range" min={.25} max={1} step={.05} value={multiplier} onChange={event => setMultiplier(Number(event.target.value))} className="w-28 accent-[#635bff]"/>
        <span className="w-10 font-mono text-foreground">{multiplier.toFixed(2)}×</span>
      </label>
    </div>
    <div className="divide-y divide-hairline">{rows.map(row => <article key={row.company._id} className="py-5">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/company/${row.company._id}`} className="flex min-w-0 items-center gap-3 hover:text-accent"><BusinessAvatar category={row.company.category}/><span><span className="block text-sm font-medium">{row.company.name}</span><span className="mt-1 block text-[10px] secondary">{row.company.city}, {row.company.state} · {categoryName(row.company.category)}</span></span></Link>
        <div className="shrink-0 text-right"><span className="block text-lg tracking-tight">{usd(row.fraction * scale * bankroll, {cents:false})}</span><span className="text-[10px] secondary">{pct(row.fraction * scale, 1)} of available cash</span></div>
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-5 secondary">{row.why}</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4"><details className="min-w-0 flex-1"><summary className="cursor-pointer text-[11px] text-muted-foreground">Valuation & sizing details</summary><dl className="mt-3 grid grid-cols-2 gap-4 rounded-lg bg-surface p-4 sm:grid-cols-4">{[["Price / share",`$${px(row.price)}`],["Model / share",`$${px(row.model_value)}`],["Estimated edge",pct(row.edge,2)],["Volatility (σ)",row.sigma.toFixed(2)]].map(([label,value])=><div key={label}><dt className="eyebrow text-[9px]">{label}</dt><dd className="mt-1 font-mono text-xs">{value}</dd></div>)}</dl><p className="mt-2 text-[10px] secondary">Kelly factor {multiplier.toFixed(2)} · 20% per business · 80% total allocation cap</p></details><Link href={`/company/${row.company._id}`} className="flex items-center gap-1.5 text-xs text-accent">Explore<ArrowUpRight size={13}/></Link></div>
    </article>)}</div>
  </div>;
}
