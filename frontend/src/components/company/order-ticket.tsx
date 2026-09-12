"use client";

import { useState } from "react";
import type { Book, Order, Side } from "@contracts/types";
import { placeOrder } from "@/lib/api";
import { px, usd } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

export function OrderTicket({ marketId, book, last }: { marketId: string; book: Book | null; last: number | null }) {
  const [side, setSide] = useState<Side>("buy");
  const [qty, setQty] = useState("50");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const bestBid = book?.bids[0]?.price ?? null;
  const bestAsk = book?.asks[0]?.price ?? null;
  const suggested = side === "buy" ? bestAsk : bestBid;
  const q = Number(qty);
  const l = limit === "" ? suggested : Number(limit);
  const notional = q > 0 && l ? q * l : null;
  const disabled = busy || !book || book.halted || !(q > 0) || !l;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || l === null) return;
    setBusy(true);
    setErr(null);
    try {
      const o = await placeOrder(marketId, { side, qty: q, limit_price: l });
      setPlaced(o);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Order rejected");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-card border border-line">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <Label>Order ticket</Label>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-px bg-line border border-line" role="radiogroup" aria-label="Side">
          {(["buy", "sell"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
              className={cn(
                "py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150 ease-out active:scale-[0.98]",
                side === s ? (s === "buy" ? "bg-up/[0.10] text-up" : "bg-down/[0.10] text-down") : "bg-card text-muted-foreground hover:bg-surface",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label as="div" tracking="tight" className="mb-1.5">Shares</Label>
            <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="font-mono tabular-nums" aria-label="Shares" />
          </div>
          <div>
            <Label as="div" tracking="tight" className="mb-1.5">Limit</Label>
            <Input
              inputMode="decimal"
              value={limit}
              placeholder={suggested !== null ? px(suggested) : ""}
              onChange={(e) => setLimit(e.target.value)}
              className="font-mono tabular-nums"
              aria-label="Limit price"
            />
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
          <dt className="uppercase tracking-[0.08em] text-muted-foreground">Notional</dt>
          <dd className="text-right">{notional !== null ? usd(notional) : "\u2014"}</dd>
          <dt className="uppercase tracking-[0.08em] text-muted-foreground">Last</dt>
          <dd className="text-right">{px(last)}</dd>
          <dt className="uppercase tracking-[0.08em] text-muted-foreground">Band</dt>
          <dd className="text-right">{book ? `${px(book.band.low)} to ${px(book.band.high)}` : "\u2014"}</dd>
        </dl>
        <Button type="submit" variant="primary" size="lg" disabled={disabled} className="w-full">
          {busy ? "Placing" : `Place ${side} order`}
        </Button>
        {placed ? (
          <Callout tone={placed.side === "buy" ? "up" : "down"}>
            <span className="font-mono text-[11px] tabular-nums">
              {placed.side} {placed.qty} @ {px(placed.limit_price)} resting
            </span>
          </Callout>
        ) : null}
        {err ? (
          <Callout tone="down">
            <span className="font-mono text-[11px]">{err}</span>
          </Callout>
        ) : null}
      </div>
    </form>
  );
}
