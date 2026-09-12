"use client";

import { useMemo } from "react";
import type { Batch } from "@contracts/types";
import { figure } from "@/lib/auction-figure";
import { Plate } from "@/components/ui/plate";

const MONO = "var(--font-plex-mono), 'IBM Plex Mono', ui-monospace, monospace";

/**
 * How one round cleared. Demand and supply from the sealed book, the price that moved the most
 * shares, and who was rationed. Drawn from the round's own snapshot, so it is a record, not a
 * reconstruction.
 */
export function RoundFigure({ batch, modelPrice }: { batch: Batch | null; modelPrice: number | null }) {
  const geo = useMemo(() => {
    if (!batch || !batch.book_snapshot || batch.clearing_price === null) return null;
    const star = { p: batch.clearing_price, d: batch.demand ?? 0, s: batch.supply ?? 0, v: batch.volume };
    return figure(batch.book_snapshot.bids, batch.book_snapshot.asks, batch.clearing_price, 400, 170, star);
  }, [batch]);

  if (!batch || batch.clearing_price === null) {
    return (
      <Plate id="How the round cleared" caption="">
        <div className="h-[170px] grid place-items-center text-[13px] secondary px-4 text-center">Select a round on the chart, or wait for the next clear.</div>
      </Plate>
    );
  }

  const p = batch.clearing_price;
  const d = batch.demand ?? 0;
  const s = batch.supply ?? 0;
  const short = d > s ? "sellers" : s > d ? "buyers" : null;
  const fillPct = short === "buyers" ? (batch.volume / d) * 100 : short === "sellers" ? (batch.volume / s) * 100 : 100;
  const vsModel = modelPrice ? ((p - modelPrice) / modelPrice) * 100 : null;

  return (
    <Plate id={`How round ${batch.round ?? ""} cleared`} caption={`${p.toFixed(2)} · ${batch.volume} sh`}>
      {geo ? (
        <svg viewBox={`0 0 ${geo.W} ${geo.H}`} className="block w-full h-auto" role="img" aria-label={`Round cleared at ${p.toFixed(2)} on ${batch.volume} shares`}>
          <line x1={0} x2={geo.W} y1={geo.H - geo.mB} y2={geo.H - geo.mB} stroke="#d3d3e5" strokeWidth={0.5} />
          {/* shaded executed volume */}
          <rect x={geo.x(geo.xMin)} y={geo.y(geo.star.v)} width={geo.x(geo.star.p) - geo.x(geo.xMin)} height={geo.y(0) - geo.y(geo.star.v)} fill="#755cfe" opacity={0.06} />
          <path d={geo.supply} fill="none" stroke="#ee5557" strokeWidth={1.25} pathLength={1} className="bartr-draw" />
          <path d={geo.demand} fill="none" stroke="#2bc392" strokeWidth={1.25} pathLength={1} className="bartr-draw" />
          <line x1={geo.x(geo.star.p)} x2={geo.x(geo.star.p)} y1={geo.mT} y2={geo.H - geo.mB} stroke="#755cfe" strokeWidth={1} />
          <circle cx={geo.x(geo.star.p)} cy={geo.y(geo.star.v)} r={3.5} fill="#755cfe" stroke="#fff" strokeWidth={1.5} />
          <text x={geo.x(geo.star.p)} y={geo.mT - 3} fontSize={10} fill="#755cfe" fontFamily={MONO} textAnchor="middle">p* {p.toFixed(2)}</text>
          <text x={geo.x(geo.lo)} y={geo.H - 8} fontSize={9} fill="#6c6991" fontFamily={MONO} textAnchor="start">{geo.lo.toFixed(2)}</text>
          <text x={geo.x(geo.hi)} y={geo.H - 8} fontSize={9} fill="#6c6991" fontFamily={MONO} textAnchor="end">{geo.hi.toFixed(2)}</text>
          <text x={geo.W - 10} y={geo.mT + 6} fontSize={8.5} fill="#2bc392" fontFamily={MONO} textAnchor="end">demand</text>
          <text x={geo.W - 10} y={geo.mT + 17} fontSize={8.5} fill="#ee5557" fontFamily={MONO} textAnchor="end">supply</text>
        </svg>
      ) : (
        <div className="h-[170px]" />
      )}
      <dl className="grid grid-cols-3 gap-x-3 gap-y-1 px-3 py-2.5 border-t border-line font-mono text-[11px] tabular-nums">
        <dt className="text-muted-foreground uppercase tracking-[0.08em]">Wanted</dt>
        <dt className="text-muted-foreground uppercase tracking-[0.08em]">Offered</dt>
        <dt className="text-muted-foreground uppercase tracking-[0.08em]">Traded</dt>
        <dd className="text-up">{d.toFixed(0)} sh at or above {p.toFixed(2)}</dd>
        <dd className="text-down">{s.toFixed(0)} sh at or below {p.toFixed(2)}</dd>
        <dd className="text-foreground">{batch.volume} sh, one price</dd>
      </dl>
      <p className="px-3 pb-3 text-[13px] leading-[1.5] secondary">
        {p.toFixed(2)} moved more shares than any other price.{" "}
        {short ? `${short === "buyers" ? "Buyers" : "Sellers"} wanted more than the other side offered, so each was filled ${fillPct.toFixed(0)}% pro rata.` : "Both sides filled in full."}{" "}
        {batch.band_hit ? "The 10% band clamped the move; the rest carries to the next round. " : ""}
        {vsModel !== null ? `${vsModel >= 0 ? "+" : ""}${vsModel.toFixed(1)}% against the model value.` : ""}
      </p>
    </Plate>
  );
}
