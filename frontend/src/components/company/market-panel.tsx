"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@contracts/types";
import { useMarket } from "@/hooks/use-market";
import { bidderLabel, sideVerb } from "@/lib/bidder";
import { px, signed, usd } from "@/lib/format";
import { RoundClock } from "./round-clock";
import { PricePath } from "./price-path";
import { RoundFigure } from "./round-figure";
import { OrderBook } from "./order-book";
import { Participants } from "./participants";
import { OrderTicket } from "./order-ticket";
import { OfferPanel } from "./offer-panel";
import { OfferLetter } from "./offer-letter";
import type { OfferDraft } from "@/lib/offer-letter";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { closingHref, detectWins } from "@/lib/closing";

export function MarketPanel({ company }: { company: Company }) {
  const listed = company.listed !== false;
  const live = company.status === "ready" && listed;
  const m = useMarket(company._id, live, true);
  const [selected, setSelected] = useState<string | null>(null);
  const [offer, setOffer] = useState<OfferDraft | null>(null);
  const router = useRouter();
  const placedHere = useRef<Set<string>>(new Set());
  const won = useRef(false);

  // The moment an order from this ticket clears, the buyer signs for the shares.
  useEffect(() => {
    if (won.current) return;
    const win = detectWins(placedHere.current, m.fills).find((o) => o.side === "buy");
    if (!win) return;
    won.current = true;
    const price = m.last ?? win.limit_price;
    router.push(closingHref(company._id, { kind: "shares", qty: win.filled_qty, price, orderId: win._id, round: Math.max(1, m.round - 1) }));
  }, [m.fills, m.last, m.round, company._id, router]);

  const shares = company.market?.shares_outstanding ?? 10000;
  const ref = company.valuation ? company.valuation.v0 / shares : null;
  const change = m.last !== null && m.prev !== null ? m.last - m.prev : null;
  const interval = company.market?.batch_interval_s ?? 10;
  const priced = m.batches.filter((b) => b.clearing_price !== null);
  const selectedBatch = (selected ? priced.find((b) => b._id === selected) : null) ?? priced.at(-1) ?? null;
  const print = m.last ?? ref;
  const companyValue = print !== null ? print * shares : company.valuation?.v0 ?? null;
  const lastLabel = m.last !== null ? "Last clearing" : "Opening";
  const arrival = m.arrivals[0] ?? null;

  return (
    <>
      <div className="border-y border-line bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:border-x xl:border-line 3xl:max-w-8xl">
          <div className="grid items-end gap-6 py-6 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
              <div>
                <Label tracking="tight" className="mb-1 block">{lastLabel}</Label>
                <div
                  key={m.tick}
                  className={cn(
                    "min-w-[5ch] -mx-1 px-1 text-[56px] leading-[0.92] tabular-nums md:text-[72px]",
                    m.tick > 0 && "bartr-clear",
                    m.flash && (m.dir === "up" ? "text-up" : m.dir === "down" ? "text-down" : ""),
                  )}
                >
                  {usd(print)}
                </div>
                <div className={cn("mt-2 font-mono text-[13px] tabular-nums", change === null ? "text-muted-foreground" : change >= 0 ? "text-up" : "text-down")}>
                  {change === null ? "No print yet" : `${signed(change)} last round`}
                </div>
              </div>
              <div>
                <Label tracking="tight" className="mb-1 block">Company value</Label>
                <div className="text-[40px] leading-[0.95] tabular-nums md:text-[56px]">
                  {usd(companyValue, { cents: false })}
                </div>
                <div className="mt-2 font-mono text-[13px] tabular-nums text-muted-foreground">
                  {shares.toLocaleString("en-US")} sh{ref !== null ? ` · model ${usd(ref)}` : ""}
                </div>
              </div>
            </div>
            {live ? (
              <RoundClock round={m.round} nextBatchAt={m.book?.next_batch_at} interval={interval} pending={m.pending} justCleared={m.justCleared} />
            ) : (
              <Label>{listed ? "Not priced yet" : "Not on the exchange"}</Label>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 xl:border-x xl:border-line 3xl:max-w-8xl">
        {arrival ? (
          <p className="bartr-print mb-4 border border-up/30 bg-up/[0.08] px-3 py-2 font-mono text-[13px] tabular-nums text-up">
            {bidderLabel(arrival, m.book?.you ?? null)} is {sideVerb(arrival.side)} {arrival.qty}
            {arrival.price != null ? ` at ${px(arrival.price)}` : ""}
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-4 order-first lg:order-none lg:col-start-2 lg:sticky lg:top-4 lg:self-start">
            {live ? (
              <OrderTicket
                marketId={company._id}
                book={m.book}
                nextBatchAt={m.book?.next_batch_at}
                round={m.round}
                onPlaced={(o) => placedHere.current.add(o._id)}
              />
            ) : null}
            {!listed ? <OfferPanel company={company} offer={offer} onOffer={setOffer} /> : null}
            <div className="flex gap-4 px-1 font-mono text-[11px] uppercase tracking-[0.08em]">
              <a href={`/company/${company._id}/acquire`} className="text-muted-foreground hover:text-foreground">
                Acquire
              </a>
              <a href="/overview" className="text-muted-foreground hover:text-foreground">
                Portfolio
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
            {live ? (
              <>
                <Participants book={m.book} arrivals={m.arrivals} />
                <OrderBook book={m.book} last={m.last ?? ref} tick={m.tick} dir={m.dir} changed={m.changed} mine={m.mine} />
                <RoundFigure batch={selectedBatch} book={m.book} modelPrice={ref} justCleared={m.justCleared} />
                <PricePath batches={m.batches} refPrice={ref} selected={selected} onSelect={setSelected} opening={ref} />
              </>
            ) : null}
            {!listed && offer ? <OfferLetter offer={offer} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
