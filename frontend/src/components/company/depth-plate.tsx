"use client";

import { useMemo } from "react";
import type { Book } from "@contracts/types";
import { Plate } from "@/components/ui/plate";

/**
 * The auction as a picture. demand(p) = buy qty with limit >= p, supply(p) = sell qty
 * with limit <= p. The clearing price is where min(demand, supply) is largest. Both curves are
 * computed from the live book, so this is evidence, not ornament.
 */
export function DepthPlate({ book, tick, last }: { book: Book | null; tick: number; last: number | null }) {
  const geo = useMemo(() => {
    if (!book || (book.bids.length === 0 && book.asks.length === 0)) return null;
    const prices = Array.from(new Set([...book.bids, ...book.asks].map((l) => l.price))).sort((a, b) => a - b);
    const lo = prices[0];
    const hi = prices[prices.length - 1];
    const pad = (hi - lo) * 0.06 || 1;
    const xMin = lo - pad;
    const xMax = hi + pad;
    const pts = prices.map((p) => {
      const d = book.bids.filter((b) => b.price >= p).reduce((s, b) => s + b.qty, 0);
      const s = book.asks.filter((a) => a.price <= p).reduce((t, a) => t + a.qty, 0);
      return { p, d, s, v: Math.min(d, s) };
    });
    const anchor = last ?? book.last ?? pts[0].p;
    let star = pts[0];
    for (const q of pts) {
      const better =
        q.v > star.v ||
        (q.v === star.v && Math.abs(q.d - q.s) < Math.abs(star.d - star.s)) ||
        (q.v === star.v && Math.abs(q.d - q.s) === Math.abs(star.d - star.s) && Math.abs(q.p - anchor) < Math.abs(star.p - anchor));
      if (better) star = q;
    }
    const yMax = Math.max(1, ...pts.map((q) => Math.max(q.d, q.s)));
    const W = 400;
    const H = 150;
    const mL = 8;
    const mR = 8;
    const mT = 10;
    const mB = 22;
    const x = (p: number) => mL + ((p - xMin) / (xMax - xMin)) * (W - mL - mR);
    const y = (v: number) => H - mB - (v / yMax) * (H - mT - mB);
    // step paths: demand is non-increasing in p, supply non-decreasing
    const demand = [`M ${x(xMin)} ${y(pts[0].d)}`];
    pts.forEach((q, i) => {
      const next = pts[i + 1];
      demand.push(`H ${x(q.p)}`);
      if (next) demand.push(`V ${y(next.d)}`);
    });
    demand.push(`H ${x(xMax)}`, `V ${y(0)}`);
    const supply = [`M ${x(xMin)} ${y(0)}`];
    pts.forEach((q) => {
      supply.push(`H ${x(q.p)}`, `V ${y(q.s)}`);
    });
    supply.push(`H ${x(xMax)}`);
    return { W, H, x, y, demand: demand.join(" "), supply: supply.join(" "), star, xMin, xMax, lo, hi, mB, yMax };
  }, [book, last]);

  const caption = geo ? `${geo.star.p.toFixed(2)} · ${geo.star.v} sh` : "";

  return (
    <Plate id="This round" caption={caption} className="h-full">
      {geo ? (
        <svg key={tick} viewBox={`0 0 ${geo.W} ${geo.H}`} className="block w-full h-auto" role="img" aria-label={`Demand and supply curves; clearing price ${geo.star.p.toFixed(2)} at volume ${geo.star.v}`}>
          {/* axis */}
          <line x1={0} x2={geo.W} y1={geo.H - geo.mB} y2={geo.H - geo.mB} stroke="#d3d3e5" strokeWidth={0.5} />
          {/* supply dashed, demand solid, both accent */}
          <path d={geo.supply} fill="none" stroke="#755cfe" strokeWidth={1} strokeDasharray="3 2" opacity={0.7} pathLength={1} className="bartr-draw" />
          <path d={geo.demand} fill="none" stroke="#755cfe" strokeWidth={1} opacity={0.7} pathLength={1} className="bartr-draw" />
          {/* clearing marker */}
          <line x1={geo.x(geo.star.p)} x2={geo.x(geo.star.p)} y1={geo.y(geo.star.v)} y2={geo.H - geo.mB} stroke="#1d1956" strokeWidth={0.75} />
          <circle cx={geo.x(geo.star.p)} cy={geo.y(geo.star.v)} r={2.5} fill="#755cfe" />
          {/* labels */}
          <text x={geo.x(geo.lo)} y={geo.H - 8} fontSize={9} fill="#6c6991" fontFamily="var(--font-plex-mono), monospace" textAnchor="start">{geo.lo.toFixed(2)}</text>
          <text x={geo.x(geo.hi)} y={geo.H - 8} fontSize={9} fill="#6c6991" fontFamily="var(--font-plex-mono), monospace" textAnchor="end">{geo.hi.toFixed(2)}</text>
          <text x={geo.x(geo.star.p)} y={geo.H - 8} fontSize={9} fill="#1d1956" fontFamily="var(--font-plex-mono), monospace" textAnchor="middle">{geo.star.p.toFixed(2)}</text>
          <text x={geo.W - 10} y={geo.y(geo.yMax) + 8} fontSize={8} fill="#6c6991" fontFamily="var(--font-plex-mono), monospace" textAnchor="end">
            supply · · ·   demand ——
          </text>
        </svg>
      ) : (
        <div className="h-[150px]" />
      )}
    </Plate>
  );
}
