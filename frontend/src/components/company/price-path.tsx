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

export function PricePath({
  batches,
  refPrice,
  selected,
  onSelect,
  opening,
}: {
  batches: Batch[];
  refPrice: number | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  opening?: number | null;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const priced = useMemo(() => {
    const all = batches.filter((b): b is Batch & { clearing_price: number } => b.clearing_price !== null);
    return all.slice(-24).map((b, i) => ({ ...b, r: i + 1 }));
  }, [batches]);

  const geo = useMemo(() => {
    const W = 960, H = 380, mL = 52, mR = 100, mT = 28, mB = 40;
    const pts = [
      ...(opening != null ? [{ r: 0, clearing_price: opening, volume: 0, _id: "open" }] : []),
      ...priced,
    ];
    if (pts.length === 0) return null;
    const ys = pts.map((b) => b.clearing_price);
    if (refPrice !== null) ys.push(refPrice);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = (hi - lo) * 0.22 || hi * 0.04 || 1;
    lo -= pad; hi += pad;
    const step = niceStep(hi - lo);
    const grid: number[] = [];
    for (let g = Math.ceil(lo / step) * step; g <= hi; g += step) grid.push(Math.round(g * 100) / 100);
    const r0 = pts[0].r, r1 = Math.max(pts[pts.length - 1].r, 2);
    const span = Math.max(1, r1 - r0);
    const x = (r: number) => mL + ((r - r0) / span) * (W - mL - mR);
    const y = (p: number) => mT + (1 - (p - lo) / (hi - lo)) * (H - mT - mB);
    const vMax = Math.max(1, ...priced.map((b) => b.volume));
    const line = pts.map((b, i) => `${i === 0 ? "M" : "L"} ${x(b.r)} ${y(b.clearing_price)}`).join(" ");
    const area = `${line} L ${x(pts[pts.length - 1].r)} ${H - mB} L ${x(pts[0].r)} ${H - mB} Z`;
    return { W, H, mL, mR, mT, mB, x, y, lo, hi, grid, vMax, line, area, r0, r1, pts };
  }, [priced, refPrice, opening]);

  const latest = priced.at(-1);
  const pinned = selected !== null && priced.some((b) => b._id === selected);
  const caption = latest
    ? `${priced.length} ${priced.length === 1 ? "print" : "prints"} · last ${latest.clearing_price.toFixed(2)}`
    : "waiting for the first print";

  return (
    <Plate id="Clearing by round" caption={caption}>
      {geo ? (
        <div className="relative">
          {pinned ? (
            <button type="button" onClick={() => onSelect(null)} className="absolute right-2 top-2 z-10 h-6 border border-accent bg-card px-2 font-mono text-[10px] text-accent hover:bg-surface">
              pinned R{priced.find((b) => b._id === selected)?.r} · live
            </button>
          ) : null}
          <svg viewBox={`0 0 ${geo.W} ${geo.H}`} className="block h-auto w-full select-none" role="img" aria-label="Clearing price by round">
            <defs>
              <linearGradient id="bartr-path-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#755cfe" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#755cfe" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {geo.grid.map((p) => (
              <g key={p}>
                <line x1={geo.mL} x2={geo.W - geo.mR} y1={geo.y(p)} y2={geo.y(p)} stroke="#ececf4" strokeWidth={1} />
                <text x={geo.mL - 8} y={geo.y(p) + 3.5} fontSize={10} fill="#6c6991" fontFamily={MONO} textAnchor="end">{p.toFixed(2)}</text>
              </g>
            ))}
            {refPrice !== null ? (
              <g>
                <line x1={geo.mL} x2={geo.W - geo.mR} y1={geo.y(refPrice)} y2={geo.y(refPrice)} stroke="#a1a0b8" strokeWidth={1.25} strokeDasharray="5 5" />
                <text x={geo.W - geo.mR + 8} y={geo.y(refPrice) + 4} fontSize={10} fill="#6c6991" fontFamily={MONO}>our value {refPrice.toFixed(2)}</text>
              </g>
            ) : null}
            <path d={geo.area} fill="url(#bartr-path-fill)" />
            <path d={geo.line} fill="none" stroke="#755cfe" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {geo.pts.map((b, i) => {
              const isOpen = b._id === "open";
              const prev = geo.pts[i - 1];
              const moved = !isOpen && prev ? (b.clearing_price - prev.clearing_price) / prev.clearing_price : 0;
              const tone = isOpen || !prev || Math.abs(moved) < 0.002 ? "#755cfe" : moved > 0 ? "#2bc392" : "#ee5557";
              const isSel = !isOpen && (pinned ? b._id === selected : b._id === latest?._id);
              const isHover = b._id === hover;
              const r = isOpen ? 4 : 5 + ((b.volume ?? 0) / geo.vMax) * 4;
              return (
                <g
                  key={b._id}
                  className={isOpen ? undefined : "cursor-pointer"}
                  onMouseEnter={() => !isOpen && setHover(b._id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => !isOpen && onSelect(b._id === selected ? null : b._id)}
                >
                  {isSel || isHover ? <line x1={geo.x(b.r)} x2={geo.x(b.r)} y1={geo.mT} y2={geo.H - geo.mB} stroke={isSel ? "#755cfe" : "#d3d3e5"} strokeWidth={1} /> : null}
                  <circle cx={geo.x(b.r)} cy={geo.y(b.clearing_price)} r={r} fill={tone} stroke="#fff" strokeWidth={2} className={cn(!isOpen && i === geo.pts.length - 1 && "bartr-pop")} />
                  {(isSel || isHover || isOpen) ? (
                    <text x={geo.x(b.r)} y={geo.y(b.clearing_price) - 12} fontSize={11} fill="#1d1956" fontFamily={MONO} textAnchor="middle">
                      {isOpen ? `open ${b.clearing_price.toFixed(2)}` : `${b.clearing_price.toFixed(2)}`}
                    </text>
                  ) : null}
                  <text x={geo.x(b.r)} y={geo.H - 10} fontSize={10} fill="#6c6991" fontFamily={MONO} textAnchor="middle">
                    {isOpen ? "open" : `R${b.r}`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="grid h-[380px] place-items-center font-mono text-[13px] text-muted-foreground">
          Open
        </div>
      )}
    </Plate>
  );
}
