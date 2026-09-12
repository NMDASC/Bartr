"use client";

import type { Book } from "@contracts/types";
import { px, qty } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

function Side({ levels, side, max }: { levels: Book["bids"]; side: "bid" | "ask"; max: number }) {
  const isBid = side === "bid";
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-line">
          {isBid ? (
            <>
              <th className="py-1.5 pl-2 text-left"><Label tracking="tight">Qty</Label></th>
              <th className="py-1.5 pr-2 text-right"><Label tracking="tight">Bid</Label></th>
            </>
          ) : (
            <>
              <th className="py-1.5 pl-2 text-left"><Label tracking="tight">Ask</Label></th>
              <th className="py-1.5 pr-2 text-right"><Label tracking="tight">Qty</Label></th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {levels.slice(0, 9).map((l, i) => {
          const w = Math.min(100, (l.qty / max) * 100);
          const owner = l.origin === "treasury";
          return (
            <tr key={`${l.price}-${i}`} className="relative border-b border-hairline-soft">
              <td
                colSpan={2}
                className="absolute inset-y-0 pointer-events-none"
                style={{
                  [isBid ? "right" : "left"]: 0,
                  width: `${w}%`,
                  background: isBid ? "rgb(43 195 146 / 0.08)" : "rgb(238 85 87 / 0.08)",
                }}
                aria-hidden
              />
              {isBid ? (
                <>
                  <td className={cn("relative py-1 pl-2 font-mono text-[12px] tabular-nums", owner ? "text-tint-500" : "text-foreground")}>
                    {qty(l.qty)}
                    {owner ? <span className="ml-1.5 text-[9px] uppercase tracking-[0.06em]">owner</span> : null}
                  </td>
                  <td className="relative py-1 pr-2 text-right font-mono text-[12px] tabular-nums text-up">{px(l.price)}</td>
                </>
              ) : (
                <>
                  <td className="relative py-1 pl-2 font-mono text-[12px] tabular-nums text-down">{px(l.price)}</td>
                  <td className={cn("relative py-1 pr-2 text-right font-mono text-[12px] tabular-nums", owner ? "text-tint-500" : "text-foreground")}>
                    {owner ? <span className="mr-1.5 text-[9px] uppercase tracking-[0.06em]">owner</span> : null}
                    {qty(l.qty)}
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function OrderBook({ book, last, tick }: { book: Book | null; last: number | null; tick: number }) {
  if (!book) return <div className="h-64 bg-surface animate-pulse" aria-hidden />;
  const max = Math.max(1, ...book.bids.map((b) => b.qty), ...book.asks.map((a) => a.qty));
  const bestBid = book.bids[0]?.price ?? null;
  const bestAsk = book.asks[0]?.price ?? null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  return (
    <div className="bg-card border border-line">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <Label>Order book</Label>
        <div className="flex items-center gap-4 font-mono text-[11px] tabular-nums">
          <span className="text-muted-foreground">
            {spread !== null && spread <= 0 ? (
              <span className="text-accent uppercase tracking-[0.08em] text-[10px]">crossed</span>
            ) : (
              <>spread <span className="text-foreground">{spread !== null ? spread.toFixed(2) : "\u2014"}</span></>
            )}
          </span>
          <span key={tick} className={cn("px-1.5 -mx-1.5 text-accent", tick > 0 && "jb-clear")}>last {px(last)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-line">
        <Side levels={book.bids} side="bid" max={max} />
        <Side levels={book.asks} side="ask" max={max} />
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <span>band {px(book.band.low)} to {px(book.band.high)}</span>
        {book.halted ? <span className="text-down">halted</span> : null}
      </div>
    </div>
  );
}
