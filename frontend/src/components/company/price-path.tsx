"use client";

import { useMemo, useState } from "react";
import type { Batch } from "@contracts/types";
import { Plate } from "@/components/ui/plate";
import { cn } from "@/lib/cn";

const MONO = "var(--font-plex-mono), 'IBM Plex Mono', ui-monospace, monospace";

/**
 * One point per round. The line steps because a clearing price holds until the next round; the
 * dashed line is the model value; dot size is volume; the selected round is drawn in the accent.
 * Rounds with no trade are not points: nothing was priced.
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
  onSelect: (id: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const priced = useMemo(() => batches.filter((b): b is Batch & { clearing_price: number } => b.clearing_price !== null).slice(-60), [batches]);

  const geo = useMemo(() => {
    if (priced.length === 0) return null;
    const W = 720, H = 260, mL = 10, mR = 54, mT = 16, mB = 34;
    const ys = priced.map((b) => b.clearing_price);
    if (refPrice !== null) ys.push(refPrice);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = (hi - lo) * 0.18 || hi * 0.04 || 1;
    lo -= pad; hi += pad;
    const n = priced.length;
    const x = (i: number) => (n === 1 ? (W - mL - mR) / 2 + mL : mL + (i / (n - 1)) * (W - mL - mR));
    const y = (p: number) => mT + (1 - (p - lo) / (hi - lo)) * (H - mT - mB);
    const vMax = Math.max(1, ...priced.map((b) => b.volume));
    const step = priced.map((b, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(b.clearing_price)}${i < n - 1 ? ` H ${x(i + 1)}` : ""}`).join(" ");
    return { W, H, mL, mR, mT, mB, x, y, lo, hi, vMax, step, n };
  }, [priced, refPrice]);

  const latest = priced.at(-1);
  const caption = latest ? `${priced.length} rounds · last ${latest.clearing_price.toFixed(2)}` : "no rounds yet";

  return (
    <Plate id="Clearing price by round" caption={caption}>
      {geo && latest ? (
        <svg viewBox={`0 0 ${geo.W} ${geo.H}`} className="block w-full h-auto select-none" role="img" aria-label={`Clearing price across ${geo.n} rounds`}>
          {/* gridlines: min, mid, max */}
          {[geo.lo, (geo.lo + geo.hi) / 2, geo.hi].map((p, i) => (
            <g key={i}>
              <line x1={geo.mL} x2={geo.W - geo.mR} y1={geo.y(p)} y2={geo.y(p)} stroke="#e6e6ef" strokeWidth={0.75} />
              <text x={geo.W - geo.mR + 8} y={geo.y(p) + 3.5} fontSize={10} fill="#6c6991" fontFamily={MONO}>{p.toFixed(2)}</text>
            </g>
          ))}
          {/* model value */}
          {refPrice !== null ? (
            <g>
              <line x1={geo.mL} x2={geo.W - geo.mR} y1={geo.y(refPrice)} y2={geo.y(refPrice)} stroke="#a1a0b8" strokeWidth={1} strokeDasharray="4 4" />
              <text x={geo.mL + 2} y={geo.y(refPrice) - 5} fontSize={10} fill="#6c6991" fontFamily={MONO}>model {refPrice.toFixed(2)}</text>
            </g>
          ) : null}
          {/* volume bars along the floor */}
          {priced.map((b, i) => {
            const h = (b.volume / geo.vMax) * 26;
            return <rect key={b._id} x={geo.x(i) - 2.5} y={geo.H - geo.mB - h} width={5} height={h} fill="#755cfe" opacity={0.18} />;
          })}
          {/* price path */}
          <path d={geo.step} fill="none" stroke="#755cfe" strokeWidth={1.25} strokeLinejoin="round" />
          {/* rounds */}
          {priced.map((b, i) => {
            const prev = priced[i - 1];
            const up = prev ? b.clearing_price > prev.clearing_price : null;
            const isSel = b._id === selected || (selected === null && i === geo.n - 1);
            const isHover = b._id === hover;
            const r = 3 + (b.volume / geo.vMax) * 5;
            return (
              <g key={b._id} className="cursor-pointer" onMouseEnter={() => setHover(b._id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(b._id)}>
                <rect x={geo.x(i) - 8} y={geo.mT} width={16} height={geo.H - geo.mT - geo.mB} fill="transparent" />
                {isSel || isHover ? <line x1={geo.x(i)} x2={geo.x(i)} y1={geo.mT} y2={geo.H - geo.mB} stroke={isSel ? "#755cfe" : "#d3d3e5"} strokeWidth={1} strokeDasharray={isSel ? undefined : "3 3"} /> : null}
                <circle cx={geo.x(i)} cy={geo.y(b.clearing_price)} r={r} fill={up === null ? "#755cfe" : up ? "#2bc392" : "#ee5557"} stroke="#fff" strokeWidth={1.5} className={cn(i === geo.n - 1 && "bartr-pop")} />
                {isSel || isHover ? (
                  <text x={geo.x(i)} y={geo.H - geo.mB + 14} fontSize={10} fill="#1d1956" fontFamily={MONO} textAnchor={i === 0 ? "start" : i === geo.n - 1 ? "end" : "middle"}>
                    R{b.round ?? i + 1} · {b.clearing_price.toFixed(2)} · {b.volume} sh
                  </text>
                ) : null}
              </g>
            );
          })}
          <text x={geo.mL} y={geo.H - 6} fontSize={9} fill="#6c6991" fontFamily={MONO}>round {priced[0].round ?? 1}</text>
          <text x={geo.W - geo.mR} y={geo.H - 6} fontSize={9} fill="#6c6991" fontFamily={MONO} textAnchor="end">round {latest.round ?? geo.n}</text>
        </svg>
      ) : (
        <div className="h-[260px] grid place-items-center text-[13px] secondary">No round has cleared yet. The first clearing price prints when the clock hits zero with a bid and an ask that cross.</div>
      )}
    </Plate>
  );
}
