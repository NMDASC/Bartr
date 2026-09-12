"use client";

import { useMemo } from "react";
import type { Book } from "@contracts/types";
import { px } from "@/lib/format";

/** Cumulative limit demand and supply from the entire live order book. */
export function DepthPlate({ book, tick }: { book: Book | null; tick: number; last: number | null }) {
  const geometry = useMemo(() => {
    if (!book || !(book.bids.length || book.asks.length)) return null;
    const prices = Array.from(new Set([...book.bids, ...book.asks].map(level => level.price))).sort((a, b) => a - b);
    const lo = prices[0], hi = prices[prices.length - 1], pad = (hi - lo) * .06 || 1;
    const xmin = lo - pad, xmax = hi + pad, W = 480, H = 220;
    const points = prices.map(p => ({
      p,
      demand: book.bids.filter(level => level.price >= p).reduce((sum, level) => sum + level.qty, 0),
      supply: book.asks.filter(level => level.price <= p).reduce((sum, level) => sum + level.qty, 0),
    }));
    const max = Math.max(1, ...points.flatMap(p => [p.demand, p.supply]));
    const x = (price: number) => 20 + (price - xmin) / (xmax - xmin) * (W - 40);
    const y = (qty: number) => H - 30 - qty / max * (H - 55);
    const demand = [`M ${x(xmin)} ${y(points[0].demand)}`];
    points.forEach((p, i) => demand.push(`H ${x(p.p)} V ${y(points[i+1]?.demand ?? 0)}`));
    demand.push(`H ${x(xmax)}`);
    const supply = [`M ${x(xmin)} ${y(0)}`];
    points.forEach(p => supply.push(`H ${x(p.p)} V ${y(p.supply)}`));
    supply.push(`H ${x(xmax)}`);
    return { W, H, lo, hi, max, x, y, demand: demand.join(" "), supply: supply.join(" ") };
  }, [book]);
  const indicative = book?.indicative_price;
  return <section className="dashboard-panel h-full">
    <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
      <h2 className="section-title">Market depth</h2>
      <span className="text-[10px] secondary">All price levels</span>
    </div>
    {geometry ? <div className="p-4">
      <div className="mb-3 flex gap-4 text-[10px]"><span className="text-up">● Buy demand</span><span className="text-down">● Sell supply</span><span className="ml-auto secondary">Shares</span></div>
      <svg key={tick} viewBox={`0 0 ${geometry.W} ${geometry.H}`} className="block h-auto w-full" role="img" aria-label={`Cumulative buy demand and sell supply. ${indicative ? `Indicative price $${px(indicative)}.` : "No indicative clearing price yet."}`}>
        {[0, .5, 1].map(part => <g key={part}><line x1="20" x2={geometry.W-20} y1={geometry.y(part*geometry.max)} y2={geometry.y(part*geometry.max)} stroke="#edf0f6"/><text x={geometry.W-20} y={geometry.y(part*geometry.max)-5} textAnchor="end" fill="#69738a" fontSize="10">{Math.round(part*geometry.max)}</text></g>)}
        <path d={geometry.demand} fill="none" stroke="#078568" strokeWidth="2"/>
        <path d={geometry.supply} fill="none" stroke="#ce4c65" strokeWidth="2"/>
        {typeof indicative === "number" && <line x1={geometry.x(indicative)} x2={geometry.x(indicative)} y1="20" y2={geometry.H-30} stroke="#635bff" strokeWidth="1" strokeDasharray="4 4"/>}
        <text x="20" y={geometry.H-7} fill="#69738a" fontSize="10">${px(geometry.lo)}</text>
        <text x={geometry.W-20} y={geometry.H-7} textAnchor="end" fill="#69738a" fontSize="10">${px(geometry.hi)}</text>
      </svg>
      <p className="mt-2 text-[10px] secondary">{typeof indicative === "number" ? `Indicative clearing price: $${px(indicative)}` : "Buy and sell limits do not currently cross."}</p>
    </div> : <p className="p-6 text-xs secondary">Waiting for the order book.</p>}
  </section>;
}
