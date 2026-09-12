"use client";

import Link from "next/link";
import { useState } from "react";
import type { Suggestion } from "@contracts/types";
import { usd, px, pct } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

/**
 * Half-Kelly sizing from Plan.md 8.6, re-scaled client-side by the risk slider.
 * The numbers come from the API; the slider only multiplies the Kelly fraction (0.25 .. 1.0).
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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <Label className="mb-2 block">Suggested stakes</Label>
          <h2 className="text-[30px] md:text-[32px] leading-[1.2]">Sized by Kelly, matched by profile.</h2>
          <p className="mt-subhead text-[16px] secondary max-w-xl">
            f = clamp(k · ln(value / price) / σ², 0, 20%). Edge is the log gap between model value and the last clearing price.
          </p>
        </div>
        <label className="flex items-center gap-3">
          <Label tracking="tight">Kelly multiplier</Label>
          <input type="range" min={0.25} max={1} step={0.05} value={mult} onChange={(e) => setMult(Number(e.target.value))} className="w-40 accent-[#755cfe]" />
          <span className="font-mono text-[12px] tabular-nums w-10">{mult.toFixed(2)}</span>
        </label>
      </div>

      <div className="hidden md:grid grid-cols-[1fr_88px_88px_88px_72px_72px_110px] gap-4 px-3 pb-2 border-b border-line">
        <Label>Company</Label>
        <Label className="text-right">Price</Label>
        <Label className="text-right">Value</Label>
        <Label className="text-right">Edge</Label>
        <Label className="text-right">σ</Label>
        <Label className="text-right">f</Label>
        <Label className="text-right">Stake</Label>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.company._id} className="border-b border-hairline">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_88px_88px_88px_72px_72px_110px] items-start gap-x-4 gap-y-2 px-3 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/company/${r.company._id}`} className="text-[16px] hover:text-accent-deep">{r.company.name}</Link>
                  {r.edge < 0 ? <Chip tone="down">overpriced</Chip> : r.f === 0 ? <Chip tone="neutral">no edge</Chip> : <Chip tone="up">buy</Chip>}
                </div>
                <div className="text-[13px] secondary">{r.company.city}, {r.company.state} · {r.company.category}</div>
                <p className="mt-2 text-[14px] secondary max-w-2xl">{r.why}</p>
              </div>
              <div className="font-mono text-[13px] tabular-nums md:text-right">{px(r.price)}</div>
              <div className="font-mono text-[13px] tabular-nums md:text-right">{px(r.model_value)}</div>
              <div className={cn("font-mono text-[13px] tabular-nums md:text-right", r.edge >= 0 ? "text-up" : "text-down")}>{(r.edge * 100).toFixed(2)}%</div>
              <div className="font-mono text-[13px] tabular-nums md:text-right">{r.sigma.toFixed(2)}</div>
              <div className="font-mono text-[13px] tabular-nums md:text-right">{pct(r.f, 1)}</div>
              <div className="font-mono text-[13px] tabular-nums md:text-right">{usd(r.usd * scale, { cents: false })}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        Sum capped at 80% of cash{scale < 1 ? ` · scaled ×${scale.toFixed(2)}` : ""}. Diagonal covariance, thin markets.
      </p>
    </div>
  );
}
