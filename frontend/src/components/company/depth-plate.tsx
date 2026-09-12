"use client";

import { useMemo } from "react";
import type { Book } from "@contracts/types";
import { figure } from "@/lib/auction-figure";
import { Plate } from "@/components/ui/plate";

/**
 * The auction as a picture. demand(p) = buy qty with limit >= p, supply(p) = sell qty
 * with limit <= p. The clearing price is where min(demand, supply) is largest. Both curves are
 * computed from the live book, so this is evidence, not ornament.
 */
export function DepthPlate({ book, tick, last, pending = 0, round }: { book: Book | null; tick: number; last: number | null; pending?: number; round?: number }) {
  const geo = useMemo(() => (book ? figure(book.bids, book.asks, last ?? book.last ?? null) : null), [book, last]);
  const bestBid = book?.bids[0]?.price ?? null;
  const bestAsk = book?.asks[0]?.price ?? null;
  const crosses = geo !== null && geo.star.v > 0;
  const caption = geo
    ? crosses ? `would clear ${geo.star.p.toFixed(2)} · ${geo.star.v} sh` : `no cross · bid ${bestBid?.toFixed(2) ?? "—"} / ask ${bestAsk?.toFixed(2) ?? "—"}`
    : "";

  return (
    <Plate id={`Resting book for round ${round ?? ""}${pending > 0 ? ` · ${pending} new` : ""}`} caption={caption} className="h-full">
      {geo ? (
        <svg key={tick} viewBox={`0 0 ${geo.W} ${geo.H}`} className="block w-full h-auto" role="img" aria-label={`Demand and supply from the resting book; would clear at ${geo.star.p.toFixed(2)} on ${geo.star.v} shares`}>
          <line x1={0} x2={geo.W} y1={geo.H - geo.mB} y2={geo.H - geo.mB} stroke="#d3d3e5" strokeWidth={0.5} />
          <path d={geo.supply} fill="none" stroke="#ee5557" strokeWidth={1} opacity={0.85} pathLength={1} className="bartr-draw" />
          <path d={geo.demand} fill="none" stroke="#2bc392" strokeWidth={1} opacity={0.85} pathLength={1} className="bartr-draw" />
          {crosses ? <line x1={geo.x(geo.star.p)} x2={geo.x(geo.star.p)} y1={geo.y(geo.star.v)} y2={geo.H - geo.mB} stroke="#1d1956" strokeWidth={0.75} strokeDasharray="2 2" /> : null}
          {crosses ? <circle cx={geo.x(geo.star.p)} cy={geo.y(geo.star.v)} r={2.5} fill="#755cfe" /> : null}
          <text x={geo.x(geo.lo)} y={geo.H - 8} fontSize={9} fill="#6c6991" fontFamily="var(--font-plex-mono), monospace" textAnchor="start">{geo.lo.toFixed(2)}</text>
          <text x={geo.x(geo.hi)} y={geo.H - 8} fontSize={9} fill="#6c6991" fontFamily="var(--font-plex-mono), monospace" textAnchor="end">{geo.hi.toFixed(2)}</text>
          {crosses ? <text x={geo.x(geo.star.p)} y={geo.H - 8} fontSize={9} fill="#1d1956" fontFamily="var(--font-plex-mono), monospace" textAnchor="middle">{geo.star.p.toFixed(2)}</text> : null}
          {geo.clipped ? <text x={geo.W - 10} y={geo.y(geo.yMax) + 18} fontSize={8} fill="#6c6991" fontFamily="var(--font-plex-mono), monospace" textAnchor="end">owner {geo.clipped.side} {geo.clipped.qty.toFixed(0)} @ {geo.clipped.price.toFixed(2)} off scale</text> : null}
          <text x={geo.W - 10} y={geo.y(geo.yMax) + 8} fontSize={8} fill="#6c6991" fontFamily="var(--font-plex-mono), monospace" textAnchor="end">
            <tspan fill="#2bc392">demand</tspan>  <tspan fill="#ee5557">supply</tspan>
          </text>
        </svg>
      ) : (
        <div className="h-[150px]" />
      )}
    </Plate>
  );
}
