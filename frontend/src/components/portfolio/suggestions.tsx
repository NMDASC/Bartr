"use client";

import Link from "next/link";
import { useState } from "react";
import type { Suggestion } from "@contracts/types";
import { usd, px, pct, signed } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

/**
 * Half-Kelly sizing from Plan.md 8.6, re-scaled client-side by the risk slider.
 * The numbers come from the API; the slider only multiplies the Kelly fraction (0.25 .. 1.0).
 *
 * Form note: this section is deliberately NOT a column table. The positions ledger
 * sits directly above it, and two stacked tables of company rows read as one repeated
 * section no matter how they differ inside. So the section is carried by the allocation
 * bar, and each candidate gets its own labelled metric cluster instead of a shared
 * header row. The bar is also the only thing on the page that moves, and the slider
 * beside it is the cause.
 */
export function Suggestions({ initial, bankroll }: { initial: Suggestion[]; bankroll: number }) {
  const [mult, setMult] = useState(0.5);
  const rows = initial.map((s) => {
    const fStar = s.edge / (s.sigma * s.sigma);
    const f = Math.min(0.2, Math.max(0, mult * fStar));
    return { ...s, f, usd: f * bankroll };
  });
  const total = rows.reduce((a, r) => a + r.usd, 0);
  const cap = 0.8 * bankroll;
  const scale = total > cap ? cap / total : 1;
  const deployed = total * scale;
  const idle = Math.max(0, bankroll - deployed);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <h2 className="text-[30px] md:text-[36px] 3xl:text-[44px] leading-[1.2]">Suggested stakes</h2>
        <label className="flex items-center gap-3">
          <Label tracking="tight">How much of the edge to bet</Label>
          <input type="range" min={0.25} max={1} step={0.05} value={mult} onChange={(e) => setMult(Number(e.target.value))} className="w-40 accent-[#755cfe]" />
          <span className="font-mono text-[12px] tabular-nums w-10">{mult.toFixed(2)}</span>
        </label>
      </div>

      <div className="mb-9">
        <div className="flex h-2.5 w-full gap-px">
          {rows
            .filter((r) => r.usd > 0)
            .map((r) => (
              <div
                key={r.company._id}
                className="bg-up transition-[width] duration-200 ease-out"
                style={{ width: `${((r.usd * scale) / bankroll) * 100}%` }}
              />
            ))}
          <div className="flex-1 bg-hairline" />
        </div>
        <div className="mt-2.5 flex items-baseline justify-between gap-4">
          <Label tracking="tight">Deployed {usd(deployed, { cents: false })}</Label>
          <Label tracking="tight">Unallocated {usd(idle, { cents: false })}</Label>
        </div>
      </div>

      <ul>
        {rows.map((r) => {
          const cells: [string, string, string][] = [
            ["Price", px(r.price), ""],
            ["Fair value", px(r.model_value), ""],
            ["Edge", `${signed(r.edge * 100)}%`, r.edge >= 0 ? "text-up" : "text-down"],
            ["Uncertainty", r.sigma.toFixed(2), ""],
            ["Of bankroll", pct(r.f, 1), ""],
            ["Suggested", usd(r.usd * scale, { cents: false }), ""],
          ];
          return (
            <li key={r.company._id} className="border-b border-hairline py-5">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-10">
                <div className="min-w-0 md:max-w-md">
                  <div className="flex items-center gap-2">
                    <Link href={`/company/${r.company._id}`} className="text-[16px] hover:text-accent-deep">{r.company.name}</Link>
                    {r.edge < 0 ? <Chip tone="down">overpriced</Chip> : r.f === 0 ? <Chip tone="neutral">no edge</Chip> : <Chip tone="up">buy</Chip>}
                  </div>
                  <div className="text-[13px] secondary">{r.company.city}, {r.company.state} · {r.company.category.replace(/_/g, " ")}</div>
                  <p className="mt-2 text-[14px] secondary">{r.why}</p>
                </div>
                <div className="grid grid-cols-3 gap-x-7 gap-y-3.5 sm:grid-cols-6 md:w-[600px] md:shrink-0">
                  {cells.map(([label, value, tone]) => (
                    <div key={label} className="sm:text-right">
                      <Label tracking="tight">{label}</Label>
                      <div className={cn("mt-1 font-mono text-[13px] tabular-nums", tone)}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
