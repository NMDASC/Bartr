import type { BookLevel } from "@contracts/types";

/**
 * The batch auction as geometry. demand(p) = buy qty with limit >= p, supply(p) = sell qty with
 * limit <= p. The clearing price maximizes min(demand, supply); ties break on smaller imbalance,
 * then nearness to the anchor (last price, else model). Same rules as apps/api auction.py.
 */
export interface FigurePoint { p: number; d: number; s: number; v: number }

export interface Figure {
  W: number; H: number;
  x: (p: number) => number;
  y: (v: number) => number;
  demand: string;
  supply: string;
  star: FigurePoint;
  pts: FigurePoint[];
  xMin: number; xMax: number; lo: number; hi: number; yMax: number;
  mB: number; mT: number;
}

export function clearingPoint(bids: BookLevel[], asks: BookLevel[]): FigurePoint[] {
  const prices = Array.from(new Set([...bids, ...asks].map((l) => l.price))).sort((a, b) => a - b);
  return prices.map((p) => {
    const d = bids.filter((b) => b.price >= p).reduce((t, b) => t + b.qty, 0);
    const s = asks.filter((a) => a.price <= p).reduce((t, a) => t + a.qty, 0);
    return { p, d, s, v: Math.min(d, s) };
  }).map((q) => ({ ...q, v: Math.round(q.v * 100) / 100 }));
}

export function pickStar(pts: FigurePoint[], anchor: number | null): FigurePoint {
  let star = pts[0];
  const a = anchor ?? pts[0].p;
  for (const q of pts) {
    const better =
      q.v > star.v ||
      (q.v === star.v && Math.abs(q.d - q.s) < Math.abs(star.d - star.s)) ||
      (q.v === star.v && Math.abs(q.d - q.s) === Math.abs(star.d - star.s) && Math.abs(q.p - a) < Math.abs(star.p - a));
    if (better) star = q;
  }
  return star;
}

export function figure(bids: BookLevel[], asks: BookLevel[], anchor: number | null, W = 400, H = 150, star?: FigurePoint | null): Figure | null {
  if (bids.length === 0 && asks.length === 0) return null;
  const pts = clearingPoint(bids, asks);
  const chosen = star ?? pickStar(pts, anchor);
  const lo = pts[0].p;
  const hi = pts[pts.length - 1].p;
  const pad = (hi - lo) * 0.06 || 1;
  const xMin = lo - pad;
  const xMax = hi + pad;
  const yMax = Math.max(1, ...pts.map((q) => Math.max(q.d, q.s)));
  const mL = 8, mR = 8, mT = 12, mB = 22;
  const x = (p: number) => mL + ((p - xMin) / (xMax - xMin)) * (W - mL - mR);
  const y = (v: number) => H - mB - (v / yMax) * (H - mT - mB);
  const demand = [`M ${x(xMin)} ${y(pts[0].d)}`];
  pts.forEach((q, i) => {
    const next = pts[i + 1];
    demand.push(`H ${x(q.p)}`);
    if (next) demand.push(`V ${y(next.d)}`);
  });
  demand.push(`H ${x(xMax)}`, `V ${y(0)}`);
  const supply = [`M ${x(xMin)} ${y(0)}`];
  pts.forEach((q) => supply.push(`H ${x(q.p)}`, `V ${y(q.s)}`));
  supply.push(`H ${x(xMax)}`);
  return { W, H, x, y, demand: demand.join(" "), supply: supply.join(" "), star: chosen, pts, xMin, xMax, lo, hi, yMax, mB, mT };
}
