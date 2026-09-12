"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Book, Order, Portfolio, Side } from "@contracts/types";
import { getMyOrders, getPortfolio, placeOrder } from "@/lib/api";
import { px, qty as formatQty, usd } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrderTicketProps = {
  marketId: string;
  book: Book | null;
  last: number | null;
  connected?: boolean;
  refreshKey?: number;
  onPlaced?: () => void;
};

type AccountSnapshot = {
  portfolio: Portfolio & { reserved_cash?: number };
  orders: Order[];
};

// A different market starts a new ticket, including its initial quoted limit.
export function OrderTicket(props: OrderTicketProps) {
  return <OrderTicketForm key={props.marketId} {...props} />;
}

function OrderTicketForm({ marketId, book, connected = true, refreshKey = 0, onPlaced }: OrderTicketProps) {
  const [accountRevision, setAccountRevision] = useState(0);
  const [side, setSide] = useState<Side>("buy");
  const [qty, setQty] = useState("10");
  const [limit, setLimit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [accountError, setAccountError] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getPortfolio(), getMyOrders(marketId)]).then(([portfolio, orders]) => {
      if (alive) {
        setAccount({ portfolio, orders });
        setAccountError(false);
      }
    }).catch(() => {
      if (alive) {
        setAccount(null);
        setAccountError(true);
      }
    });
    return () => { alive = false; };
  }, [marketId, refreshKey, placed, accountRevision]);

  const currentBook = book?.market_id === marketId ? book : null;
  const suggested = side === "buy" ? currentBook?.asks[0]?.price : currentBook?.bids[0]?.price;
  const hasQuote = typeof suggested === "number" && Number.isFinite(suggested) && suggested > 0;

  // Initialize once when the quote first arrives. An emptied or edited field remains
  // the user's value, and subsequent book updates never change a committed limit.
  if (limit === null && hasQuote) setLimit(suggested.toFixed(2));

  const q = Number(qty);
  const l = Number(limit ?? "");
  const notional = q * l;
  const available = account ? Math.max(0, account.portfolio.cash - (account.portfolio.reserved_cash ?? 0)) : null;
  const owned = account?.portfolio.positions.find(position => position.market_id === marketId)?.qty ?? 0;
  const reservedShares = account?.orders.reduce((sum, order) =>
    order.market_id === marketId && order.side === "sell" && (order.status === "open" || order.status === "partial")
      ? sum + Math.max(0, order.qty - order.filled_qty)
      : sum, 0) ?? 0;
  const availableShares = account ? Math.max(0, Math.round((owned - reservedShares) * 100) / 100) : null;
  const invalid = !Number.isFinite(q) || !Number.isFinite(l) || q < .01 || q > 500 || l <= 0 ||
    Math.abs(q * 100 - Math.round(q * 100)) > 1e-7 || Math.abs(l * 100 - Math.round(l * 100)) > 1e-7;
  const insufficient = side === "buy"
    ? available !== null && notional > available + 1e-7
    : availableShares !== null && q > availableShares + 1e-7;
  const disabled = busy || !currentBook || currentBook.halted || !connected || invalid || insufficient || !account;

  function selectSide(next: Side) {
    if (next === side) return;
    setSide(next);
    setLimit(null);
    setPlaced(null);
    setErr(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled) return;
    setBusy(true);
    setErr(null);
    setPlaced(null);
    try {
      const order = await placeOrder(marketId, { side, qty: q, limit_price: l });
      // Reserve the accepted order immediately while the authoritative account reloads.
      setAccount(current => current ? {
        portfolio: {
          ...current.portfolio,
          reserved_cash: (current.portfolio.reserved_cash ?? 0) +
            (order.side === "buy" && !current.orders.some(item => item._id === order._id)
              ? Math.max(0, order.qty - order.filled_qty) * order.limit_price : 0),
        },
        orders: [...current.orders.filter(item => item._id !== order._id), order],
      } : current);
      setPlaced(order);
      onPlaced?.();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Order rejected");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="dashboard-panel">
    <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
      <h2 className="section-title">Make your move</h2><span className="soft-tag !text-[9px]">Limit order</span>
    </div>
    <div className="space-y-5 p-5">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1" role="group" aria-label="Order side">
        {(["buy", "sell"] as Side[]).map(value => <button key={value} type="button" aria-pressed={value === side} onClick={() => selectSide(value)}
          className={`rounded-md py-2.5 text-xs font-medium ${side === value ? (value === "buy" ? "bg-white text-up" : "bg-white text-down") : "text-muted-foreground"}`}>
          {value === "buy" ? "Buy shares" : "Sell shares"}
        </button>)}
      </div>
      <div className="space-y-3">
        <label className="block"><span className="mb-1.5 block text-[11px] text-muted-foreground">Number of shares</span>
          <Input required type="number" min="0.01" max="500" step="0.01" inputMode="decimal" value={qty}
            onChange={event => { setQty(event.target.value); setPlaced(null); }} className="!bg-white font-mono" aria-label="Shares" />
        </label>
        <label className="block"><span className="mb-1.5 block text-[11px] text-muted-foreground">Limit price per share</span>
          <div className="relative"><span className="absolute left-3 top-3 text-muted-foreground">$</span>
            <Input required type="number" min="0.01" step="0.01" inputMode="decimal" value={limit ?? ""} placeholder="Enter limit"
              onChange={event => { setLimit(event.target.value); setPlaced(null); }} className="!bg-white pl-7 font-mono" aria-label="Limit price" />
          </div>
        </label>
        <div className="flex items-center justify-between text-[10px] secondary"><span>{side === "buy" ? "Best ask" : "Best bid"}</span>
          <button type="button" disabled={!hasQuote} aria-label={`Use best ${side === "buy" ? "ask" : "bid"} as limit price`}
            onClick={() => { if (hasQuote) { setLimit(suggested.toFixed(2)); setPlaced(null); setErr(null); } }}
            className="text-accent disabled:text-muted-foreground">{hasQuote ? `$${px(suggested)}` : "—"} <span aria-hidden>↗</span></button>
        </div>
      </div>
      <div className="space-y-2 border-t border-hairline pt-4">
        <div className="flex justify-between text-xs"><span className="secondary">{side === "buy" ? "Available cash" : "Available to sell"}</span>
          <span className="font-mono">{side === "buy" ? (available === null ? "—" : usd(available)) : formatQty(availableShares)}</span>
        </div>
        {side === "sell" && account && <div className="flex justify-between gap-3 text-[10px] secondary"><span>{formatQty(owned)} shares owned</span><span>{formatQty(reservedShares)} in open sells</span></div>}
        <div className="flex justify-between text-sm"><span>Order value</span><span className="font-medium tabular-nums">{Number.isFinite(notional) && notional > 0 ? usd(notional) : "—"}</span></div>
      </div>
      <Button type="submit" variant="primary" className={`w-full ${side === "sell" ? "!bg-down" : ""}`} disabled={disabled}>
        {busy ? "Placing order…" : currentBook?.halted ? "Market paused" : !connected ? "Waiting for connection" : `${side === "buy" ? "Place buy" : "Place sell"} order`}<ArrowRight size={14} />
      </Button>
      {!account && <p className="text-xs secondary">{accountError ? <>Account balance is unavailable. <button type="button" className="text-accent underline" onClick={() => setAccountRevision(value => value + 1)}>Refresh balance</button></> : "Loading your balance…"}</p>}
      {insufficient && <p className="text-xs text-down" role="alert">{side === "buy" ? "Not enough available cash for this order." : "Not enough uncommitted shares for this sell order."}</p>}
      {invalid && qty && limit !== null && <p className="text-xs text-down">Enter 0.01 to 500 shares and a positive limit price, with up to two decimals.</p>}
      {placed && <div role="status" className="rounded-lg bg-up/5 p-3 text-up"><p className="flex items-center gap-2 text-xs"><CheckCircle2 size={14} />Order accepted</p>
        <p className="mt-1 text-[10px]">{placed.side} {placed.qty} shares at ${px(placed.limit_price)} limit. Follow its status in Your orders.</p></div>}
      {err && <p role="alert" className="rounded-lg bg-down/5 p-3 text-xs text-down">{err}</p>}
    </div>
  </form>;
}
