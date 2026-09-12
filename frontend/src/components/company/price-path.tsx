"use client";

import { useMemo, useState } from "react";
import type { Batch } from "@contracts/types";
import { Plate } from "@/components/ui/plate";
import { cn } from "@/lib/cn";

const MONO = "var(--font-plex-mono), 'IBM Plex Mono', ui-monospace, monospace";

function niceStep(range: number) {
  const raw = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10) * mag;
}

/**
 * One point per round, placed by round number so quiet rounds leave a visible gap. The line steps
 * because a clearing price holds until the next round. Dashed line: model value. Dot size: volume.
 * The figure follows the latest round unless you pin one by clicking it.
 */
export function PricePath({
  batches,
  refPrice,
  selected,
  onSelect,
}: {
  batches: Batch[];
  refPrice: number | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const priced = useMemo(() => {
    const all = batches.filter((b): b is Batch & { clearing_price: number } => b.clearing_price !== null);
    return all.slice(-60).map((b, i) => ({ ...b, r: b.round ?? i + 1 }));
  }, [batches]);

  const geo = useMemo(() => {
    if (priced.length === 0) return null;
    const W = 720, H = 260, mL = 10, mR = 54, mT = 16, mB = 34;
    const ys = priced.map((b) => b.clearing_price);
    if (refPrice !== null) ys.push(refPrice);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = (hi - lo) * 0.18 || hi * 0.04 || 1;
    lo -= pad; hi += pad;
    const step = niceStep(hi - lo);
    const grid: number[] = [];
    for (let g = Math.ceil(lo / step) * step; g <= hi; g += step) grid.push(Math.round(g * 100) / 100);
    const r0 = priced[0].r, r1 = priced[priced.length - 1].r;
    const span = Math.max(1, r1 - r0);
    const x = (r: number) => (r1 === r0 ? (W - mL - mR) / 2 + mL : mL + ((r - r0) / span) * (W - mL - mR));
    const y = (p: number) => mT + (1 - (p - lo) / (hi - lo)) * (H - mT - mB);
    const vMax = Math.max(1, ...priced.map((b) => b.volume));
    const path = priced.map((b, i) => `${i === 0 ? "M" : "L"} ${x(b.r)} ${y(b.clearing_price)}${i < priced.length - 1 ? ` H ${x(priced[i + 1].r)}` : ""}`).join(" ");
    const dotGap = priced.length > 1 ? (W - mL - mR) / span : W;
    return { W, H, mL, mR, mT, mB, x, y, lo, hi, grid, vMax, path, r0, r1, dotGap };
  }, [priced, refPrice]);

  const latest = priced.at(-1);
  const pinned = selected !== null && priced.some((b) => b._id === selected);
  const caption = latest && geo ? `rounds ${geo.r0} to ${geo.r1} · ${priced.length} priced · last ${latest.clearing_price.toFixed(2)}` : "no rounds yet";

  return (
    <Plate id="Clearing price by round" caption={caption}>
      {geo && latest ? (
        <div className="relative">
          {pinned ? (
            <button type="button" onClick={() => onSelect(null)} className="absolute right-2 top-2 z-10 h-6 px-2 border border-accent bg-card font-mono text-[10px] text-accent hover:bg-surface">
              pinned R{priced.find((b) => b._id === selected)?.r} · back to live
            </button>
          ) : null}
          <svg viewBox={`0 0 ${geo.W} ${geo.H}`} className="block w-full h-auto select-none" role="img" aria-label={`Clearing price across rounds ${geo.r0} to ${geo.r1}`}>
            {geo.grid.map((p) => (
              <g key={p}>
                <line x1={geo.mL} x2={geo.W - geo.mR} y1={geo.y(p)} y2={geo.y(p)} stroke="#e6e6ef" strokeWidth={0.75} />
                <text x={geo.W - geo.mR + 8} y={geo.y(p) + 3.5} fontSize={10} fill="#6c6991" fontFamily={MONO}>{p.toFixed(2)}</text>
              </g>
            ))}
            {refPrice !== null ? (
              <g>
                <line x1={geo.mL} x2={geo.W - geo.mR} y1={geo.y(refPrice)} y2={geo.y(refPrice)} stroke="#a1a0b8" strokeWidth={1} strokeDasharray="4 4" />
                <text x={geo.mL + 2} y={geo.y(refPrice) - 5} fontSize={10} fill="#6c6991" fontFamily={MONO}>model value {refPrice.toFixed(2)}</text>
              </g>
            ) : null}
            {priced.map((b) => {
              const h = (b.volume / geo.vMax) * 26;
              return <rect key={b._id} x={geo.x(b.r) - 2.5} y={geo.H - geo.mB - h} width={5} height={h} fill="#755cfe" opacity={0.18} />;
            })}
            <path d={geo.path} fill="none" stroke="#755cfe" strokeWidth={1.25} strokeLinejoin="round" />
            {priced.map((b, i) => {
              const prev = priced[i - 1];
              const moved = prev ? (b.clearing_price - prev.clearing_price) / prev.clearing_price : 0;
              const tone = !prev || Math.abs(moved) < 0.002 ? "#755cfe" : moved > 0 ? "#2bc392" : "#ee5557";
              const isSel = pinned ? b._id === selected : i === priced.length - 1;
              const isHover = b._id === hover;
              const showLabel = isHover || (isSel && hover === null);
              const r = 3 + (b.volume / geo.vMax) * 5;
              const anchor = b.r - geo.r0 < span(geo) * 0.15 ? "start" : geo.r1 - b.r < span(geo) * 0.15 ? "end" : "middle";
              return (
                <g key={b._id} className="cursor-pointer" onMouseEnter={() => setHover(b._id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(b._id === selected ? null : b._id)}>
                  <rect x={geo.x(b.r) - Math.max(6, geo.dotGap / 2)} y={geo.mT} width={Math.max(12, geo.dotGap)} height={geo.H - geo.mT - geo.mB} fill="transparent" />
                  {isSel || isHover ? <line x1={geo.x(b.r)} x2={geo.x(b.r)} y1={geo.mT} y2={geo.H - geo.mB} stroke={isSel ? "#755cfe" : "#d3d3e5"} strokeWidth={1} strokeDasharray={isSel ? undefined : "3 3"} /> : null}
                  <circle cx={geo.x(b.r)} cy={geo.y(b.clearing_price)} r={r} fill={tone} stroke="#fff" strokeWidth={1.5} className={cn(i === priced.length - 1 && "bartr-pop")} />
                  {showLabel ? (
                    <text x={geo.x(b.r)} y={geo.H - geo.mB + 14} fontSize={10} fill="#1d1956" fontFamily={MONO} textAnchor={anchor}>
                      R{b.r} · {b.clearing_price.toFixed(2)} · {b.volume} sh
                    </text>
                  ) : null}
                </g>
              );
            })}
            <text x={geo.mL} y={geo.H - 6} fontSize={9} fill="#6c6991" fontFamily={MONO}>round {geo.r0}</text>
            <text x={geo.W - geo.mR} y={geo.H - 6} fontSize={9} fill="#6c6991" fontFamily={MONO} textAnchor="end">round {geo.r1}</text>
          </svg>
        </div>
      ) : (
        <div className="h-[260px] grid place-items-center text-[13px] secondary">No round has cleared yet. The first clearing price prints when the clock hits zero with a bid and an ask that cross.</div>
      )}
    </Plate>
  );
}

function span(g: { r0: number; r1: number }) {
  return Math.max(1, g.r1 - g.r0);
}
