"use client";

import { useMemo } from "react";
import type { Batch, Book } from "@contracts/types";
import { figure } from "@/lib/auction-figure";
import { Plate } from "@/components/ui/plate";

const MONO = "var(--font-plex-mono), 'IBM Plex Mono', ui-monospace, monospace";

/**
 * The deck's p* picture: buyers want, sellers offer, the price that moves the most shares.
 * Live book while the clock runs; the last print when a round just cleared.
 */
export function RoundFigure({
  batch,
  book,
  modelPrice,
  justCleared,
}: {
  batch: Batch | null;
  book?: Book | null;
  modelPrice: number | null;
  justCleared?: boolean;
}) {
  const geo = useMemo(() => {
    if (justCleared && batch?.book_snapshot && batch.clearing_price !== null) {
      return figure(batch.book_snapshot.bids, batch.book_snapshot.asks, batch.clearing_price, 960, 360, {
        p: batch.clearing_price,
        d: batch.demand ?? 0,
        s: batch.supply ?? 0,
        v: batch.volume,
      });
    }
    if (book) return figure(book.bids, book.asks, book.indicative_price ?? book.last ?? modelPrice, 960, 360);
    return null;
  }, [batch, book, justCleared, modelPrice]);

  const star = geo?.star;
  const p = justCleared && batch?.clearing_price != null ? batch.clearing_price : star?.p ?? null;
  const v = justCleared && batch ? batch.volume : star?.v ?? 0;
  const caption = p != null && v > 0
    ? `${justCleared ? "cleared" : "would clear"} ${p.toFixed(2)} · ${v} sh`
    : "no cross yet";

  return (
    <Plate id="p*" caption={caption}>
      {geo && star ? (
        <svg viewBox={`0 0 ${geo.W} ${geo.H}`} className="block h-auto w-full" role="img" aria-label={`p* ${p?.toFixed(2) ?? ""}`}>
          <defs>
            <linearGradient id="bartr-demand-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2bc392" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#2bc392" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="bartr-supply-fill" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0%" stopColor="#ee5557" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#ee5557" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={`${geo.demand} L ${geo.x(geo.xMin)} ${geo.y(0)} Z`} fill="url(#bartr-demand-fill)" className="bartr-area-in" />
          <path d={`${geo.supply} L ${geo.x(geo.xMin)} ${geo.y(0)} Z`} fill="url(#bartr-supply-fill)" className="bartr-area-in" />
          <path d={geo.demand} fill="none" stroke="#2bc392" strokeWidth={1.75} pathLength={1} className="bartr-draw" />
          <path d={geo.supply} fill="none" stroke="#ee5557" strokeWidth={1.75} pathLength={1} className="bartr-draw" />
          {v > 0 && p != null ? (
            <>
              <line x1={geo.x(p)} x2={geo.x(p)} y1={geo.mT} y2={geo.H - geo.mB} stroke="#755cfe" strokeWidth={1.5} className="bartr-pstar" />
              <circle cx={geo.x(p)} cy={geo.y(v)} r={5} fill="#755cfe" stroke="#fff" strokeWidth={2} className="bartr-pop" />
              <text x={geo.x(p) + 8} y={geo.y(v) - 10} fontSize={12} fill="#755cfe" fontFamily={MONO}>p* {p.toFixed(2)}</text>
              <text x={geo.x(p) + 8} y={geo.y(v) + 14} fontSize={10} fill="#6c6991" fontFamily={MONO}>{v} shares</text>
            </>
          ) : null}
          <text x={geo.x(geo.lo)} y={geo.H - 8} fontSize={10} fill="#6c6991" fontFamily={MONO}>{geo.lo.toFixed(2)}</text>
          <text x={geo.x(geo.hi)} y={geo.H - 8} fontSize={10} fill="#6c6991" fontFamily={MONO} textAnchor="end">{geo.hi.toFixed(2)}</text>
          <text x={12} y={18} fontSize={10} fill="#2bc392" fontFamily={MONO}>buyers want</text>
          <text x={geo.W - 12} y={18} fontSize={10} fill="#ee5557" fontFamily={MONO} textAnchor="end">sellers offer</text>
        </svg>
      ) : (
        <div className="grid h-[360px] place-items-center font-mono text-[13px] text-muted-foreground">
          p*
        </div>
      )}
    </Plate>
  );
}
