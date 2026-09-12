"use client";

import type { Book } from "@contracts/types";
import { px, qty } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

const BID_BAR = "rgb(43 195 146 / 0.08)";
const ASK_BAR = "rgb(238 85 87 / 0.08)";

function Side({ levels, side, max, changed, tickSeed }: { levels: Book["bids"]; side: "bid" | "ask"; max: number; changed: Set<string>; tickSeed: number }) {
  const isBid = side === "bid";
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col style={{ width: "50%" }} />
        <col style={{ width: "50%" }} />
      </colgroup>
      <thead>
        <tr className="border-b border-line">
          <th className="py-1.5 px-2 text-left font-normal">
            <Label tracking="tight">{isBid ? "Qty" : "Ask"}</Label>
          </th>
          <th className="py-1.5 px-2 text-right font-normal">
            <Label tracking="tight">{isBid ? "Bid" : "Qty"}</Label>
          </th>
        </tr>
      </thead>
      <tbody>
        {levels.slice(0, 9).map((l, i) => {
          const w = Math.min(100, (l.qty / max) * 100);
          const owner = l.origin === "treasury";
          const moved = changed.has(`${isBid ? "b" : "a"}${l.price}`);
          const bar = isBid
            ? `linear-gradient(to left, ${BID_BAR} ${w}%, transparent ${w}%)`
            : `linear-gradient(to right, ${ASK_BAR} ${w}%, transparent ${w}%)`;
          const qtyCell = (
            <span className={cn("font-mono text-[12px] tabular-nums", owner ? "text-tint-500" : "text-foreground")}>
              {qty(l.qty)}
              {owner ? <span className="ml-1.5 text-[9px] uppercase tracking-[0.06em]">owner</span> : null}
            </span>
          );
          const priceCell = <span className={cn("font-mono text-[12px] tabular-nums", isBid ? "text-up" : "text-down")}>{px(l.price)}</span>;
          return (
            <tr key={`${l.price}-${i}-${moved ? tickSeed : 0}`} className="border-b border-hairline-soft" style={{ background: bar }}>
              <td className={cn("py-1 px-2 text-left", moved && "bartr-level")}>{isBid ? qtyCell : priceCell}</td>
              <td className={cn("py-1 px-2 text-right", moved && "bartr-level")}>{isBid ? priceCell : qtyCell}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function OrderBook({ book, last, tick, dir, changed }: { book: Book | null; last: number | null; tick: number; dir: "up" | "down" | null; changed: Set<string> }) {
  if (!book) return <div className="h-64 bg-surface animate-pulse" aria-hidden />;
  const max = Math.max(1, ...book.bids.map((b) => b.qty), ...book.asks.map((a) => a.qty));
  return (
    <div className="bg-card border border-line">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <Label>Order book</Label>
        <div className="flex items-center gap-4 font-mono text-[11px] leading-none tabular-nums">
          <span
            key={tick}
            className={cn(
              "px-1.5 -mx-1.5",
              dir === "up" ? "text-up bartr-up" : dir === "down" ? "text-down bartr-down" : "text-accent",
            )}
          >
            last {px(last)}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 items-start divide-x divide-line">
        <Side levels={book.bids} side="bid" max={max} changed={changed} tickSeed={tick} />
        <Side levels={book.asks} side="ask" max={max} changed={changed} tickSeed={tick} />
      </div>
      {book.halted ? (
        <div className="flex h-8 items-center border-t border-line px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-down">halted</div>
      ) : null}
    </div>
  );
}
