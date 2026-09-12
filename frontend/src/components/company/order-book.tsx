"use client";

import type { Book } from "@contracts/types";
import { px, qty } from "@/lib/format";
import { cn } from "@/lib/cn";

const BID_BAR = "rgb(43 195 146 / 0.16)";
const ASK_BAR = "rgb(238 85 87 / 0.16)";

function Side({
  levels,
  side,
  max,
  changed,
  tickSeed,
  yours,
}: {
  levels: Book["bids"];
  side: "bid" | "ask";
  max: number;
  changed: Set<string>;
  tickSeed: number;
  yours: Set<number>;
}) {
  const isBid = side === "bid";
  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="border-b border-line">
          <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {isBid ? "Qty" : "Asks"}
          </th>
          <th className="px-3 py-2 text-right font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {isBid ? "Bids" : "Qty"}
          </th>
        </tr>
      </thead>
      <tbody>
        {levels.slice(0, 6).map((l, i) => {
          const w = Math.min(100, (l.qty / max) * 100);
          const owner = l.origin === "treasury";
          const mine = yours.has(l.price);
          const moved = changed.has(`${isBid ? "b" : "a"}${l.price}`);
          const bar = isBid
            ? `linear-gradient(to left, ${BID_BAR} ${w}%, transparent ${w}%)`
            : `linear-gradient(to right, ${ASK_BAR} ${w}%, transparent ${w}%)`;
          const qtyCell = (
            <span className={cn("font-mono text-[15px] tabular-nums", owner ? "text-muted-foreground" : "text-foreground")}>
              {qty(l.qty)}
              {mine ? <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.06em] text-accent">you</span> : null}
              {owner ? <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.06em]">owner</span> : null}
            </span>
          );
          const priceCell = (
            <span className={cn("font-mono text-[18px] tabular-nums", isBid ? "text-up" : "text-down")}>{px(l.price)}</span>
          );
          return (
            <tr key={`${l.price}-${i}-${moved ? tickSeed : 0}`} className={cn("h-10 border-b border-hairline-soft", mine && "bg-accent/[0.06]")} style={{ background: mine ? undefined : bar }}>
              <td className={cn("px-3 text-left", moved && (isBid ? "bartr-level-bid" : "bartr-level-ask"))}>
                {isBid ? qtyCell : priceCell}
              </td>
              <td className={cn("px-3 text-right", moved && (isBid ? "bartr-level-bid" : "bartr-level-ask"))}>
                {isBid ? priceCell : qtyCell}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function OrderBook({
  book,
  tick,
  changed,
  mine = [],
}: {
  book: Book | null;
  last?: number | null;
  tick: number;
  dir?: "up" | "down" | null;
  changed: Set<string>;
  mine?: { side: "buy" | "sell"; limit_price: number }[];
}) {
  if (!book) return <div className="h-64 animate-pulse bg-surface" aria-hidden />;
  const max = Math.max(1, ...book.bids.map((b) => b.qty), ...book.asks.map((a) => a.qty));
  const yourBids = new Set(mine.filter((o) => o.side === "buy").map((o) => o.limit_price));
  const yourAsks = new Set(mine.filter((o) => o.side === "sell").map((o) => o.limit_price));
  return (
    <div className="border border-line bg-card">
      <div className="grid grid-cols-2 items-start divide-x divide-line">
        <Side levels={book.bids} side="bid" max={max} changed={changed} tickSeed={tick} yours={yourBids} />
        <Side levels={book.asks} side="ask" max={max} changed={changed} tickSeed={tick} yours={yourAsks} />
      </div>
      {book.halted ? (
        <div className="flex h-8 items-center border-t border-line px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-down">halted</div>
      ) : null}
    </div>
  );
}
