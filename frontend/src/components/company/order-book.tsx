"use client";

import { useState } from "react";
import type { Book } from "@contracts/types";
import { px, qty } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

const BID_BAR = "rgb(43 195 146 / 0.08)";
const ASK_BAR = "rgb(238 85 87 / 0.08)";

function Side({ levels, side, max }: { levels: Book["bids"]; side: "bid" | "ask"; max: number }) {
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
        {levels.map((l, i) => {
          const w = Math.min(100, (l.qty / max) * 100);
          const owner = l.origin === "treasury";
          const bar = isBid
            ? `linear-gradient(to left, ${BID_BAR} ${w}%, transparent ${w}%)`
            : `linear-gradient(to right, ${ASK_BAR} ${w}%, transparent ${w}%)`;
          const qtyCell = (
            <span className={cn("font-mono text-[12px] tabular-nums", owner ? "text-tint-500" : "text-foreground")}>
              {qty(l.qty)}
              <span className="ml-1 text-[8px] uppercase tracking-[0.03em] text-muted-foreground">{owner?"owner":l.origin}</span>
            </span>
          );
          const priceCell = <span className={cn("font-mono text-[12px] tabular-nums", isBid ? "text-up" : "text-down")}>{px(l.price)}</span>;
          return (
            <tr key={`${l.price}-${i}`} className="border-b border-hairline-soft" style={{ background: bar }}>
              <td className="py-1 px-2 text-left">{isBid ? qtyCell : priceCell}</td>
              <td className="py-1 px-2 text-right">{isBid ? priceCell : qtyCell}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function OrderBook({ book, last, tick }: { book: Book | null; last: number | null; tick: number }) {
  const [view, setView] = useState<"all"|"treasury"|"user">("all");
  if (!book) return <div className="h-64 bg-surface animate-pulse" aria-hidden />;
  const max = Math.max(1, ...book.bids.map((b) => b.qty), ...book.asks.map((a) => a.qty));
  return (
    <div className="dashboard-panel">
      <div className="flex min-h-12 flex-wrap gap-2 items-center justify-between border-b border-line px-4 py-2">
        <Label>Order book</Label>
        <div className="flex items-center gap-4 font-mono text-[11px] leading-none tabular-nums">
          <span key={tick} className={cn("px-1.5 -mx-1.5 text-accent", tick > 0 && "bartr-clear")}>
            last {px(last)}
          </span>
        </div>
      </div>
      <div className="flex gap-1 px-3 py-2" role="group" aria-label="Book participants">{(["all","treasury","user"] as const).map(v=><button type="button" key={v} aria-pressed={view===v} onClick={()=>setView(v)} className={`rounded-md px-2 py-1 text-[10px] ${view===v?"bg-accent/10 text-accent":"text-muted-foreground"}`}>{v==="all"?"All participants":v==="treasury"?"Owner liquidity":"Traders & agents"}</button>)}</div>
      <div className="grid max-h-[360px] overflow-auto grid-cols-2 items-start divide-x divide-line">
        <Side levels={book.bids.filter(l=>view==="all"||(view==="treasury"?l.origin==="treasury":l.origin!=="treasury"))} side="bid" max={max} />
        <Side levels={book.asks.filter(l=>view==="all"||(view==="treasury"?l.origin==="treasury":l.origin!=="treasury"))} side="ask" max={max} />
      </div>
      {book.halted ? (
        <div className="flex h-8 items-center border-t border-line px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-down">halted</div>
      ) : null}
    </div>
  );
}
