"use client";

import { useState } from "react";
import type { Company } from "@contracts/types";
import { useMarket } from "@/hooks/use-market";
import { px, signed, usd } from "@/lib/format";
import { RoundClock } from "./round-clock";
import { PricePath } from "./price-path";
import { RoundFigure } from "./round-figure";
import { OrderBook } from "./order-book";
import { Participants } from "./participants";
import { DepthPlate } from "./depth-plate";
import { OrderTicket } from "./order-ticket";
import { OfferPanel } from "./offer-panel";
import { Valuation } from "./valuation";
import { Sources } from "./sources";
import { Evidence } from "./evidence";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Reading order for a buyer: what it costs now and when that changes (strip), what to do about it
 * (ticket, right rail), how the price got here (path), how the last round was decided (figure),
 * what is waiting for the next round (book, depth), and why we think it is worth what we think
 * (valuation, sources, evidence).
 */
export function MarketPanel({ company }: { company: Company }) {
  const listed = company.listed !== false;
  const live = company.status === "ready" && listed;
  const m = useMarket(company._id, live);
  const [selected, setSelected] = useState<string | null>(null);

  const shares = company.market?.shares_outstanding ?? 10000;
  const ref = company.valuation ? company.valuation.v0 / shares : null;
  const marketValue = company.market?.belief?.market_value ?? null;
  const change = m.last !== null && m.prev !== null ? m.last - m.prev : null;
  const interval = company.market?.batch_interval_s ?? 10;
  const priced = m.batches.filter((b) => b.clearing_price !== null);
  const selectedBatch = (selected ? priced.find((b) => b._id === selected) : null) ?? priced.at(-1) ?? null;

  return (
    <>
      {/* price strip: the number, its change, and the clock that governs it */}
      <div className="border-t border-b border-line">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
          <div className="grid gap-x-10 gap-y-4 py-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <Label tracking="tight" className="block mb-1">{listed ? "Last clearing price" : "Our estimate, per share"}</Label>
                <div
                  key={m.tick}
                  className={cn(
                    "text-[56px] md:text-[64px] leading-[0.95] tabular-nums px-1 -mx-1",
                    m.tick > 0 && "bartr-clear",
                    m.justCleared && (m.dir === "up" ? "text-up" : m.dir === "down" ? "text-down" : ""),
                  )}
                >
                  {listed ? px(m.last) : px(ref)}
                </div>
              </div>
              <div className="pb-1">
                <Label tracking="tight" className="block mb-1">Since last round</Label>
                <div className={cn("font-mono text-[16px] tabular-nums", change === null ? "text-muted-foreground" : change >= 0 ? "text-up" : "text-down")}>
                  {change === null ? "—" : signed(change)}
                </div>
              </div>
              <div className="pb-1">
                <Label tracking="tight" className="block mb-1">Model value</Label>
                <div className="font-mono text-[16px] tabular-nums">{ref !== null ? px(ref) : "—"}<span className="text-muted-foreground"> · {company.valuation ? usd(company.valuation.v0, { compact: true }) : "—"}</span></div>
              </div>
              <div className="pb-1 hidden sm:block">
                <Label tracking="tight" className="block mb-1">Market implied</Label>
                <div className="font-mono text-[16px] tabular-nums">{m.last !== null ? usd(m.last * shares, { compact: true }) : marketValue ? usd(marketValue, { compact: true }) : "—"}</div>
              </div>
              <div className="pb-1 hidden lg:block">
                <Label tracking="tight" className="block mb-1">Owner</Label>
                <div className="font-mono text-[16px] tabular-nums">
                  {company.market?.treasury ? `${Math.round(company.market.treasury.unsold_float)} unsold · floor ${px(company.market.treasury.floor_price)}` : "—"}
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

      <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-6 xl:border-l xl:border-r xl:border-line">
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* right rail first on mobile so a judge can bid without scrolling */}
          <div className="flex flex-col gap-4 order-first lg:order-none lg:col-start-2 lg:sticky lg:top-4 lg:self-start">
            {live ? <OrderTicket marketId={company._id} book={m.book} nextBatchAt={m.book?.next_batch_at} round={m.round} /> : null}
            {!listed ? <OfferPanel company={company} /> : null}
            <Valuation company={company} last={m.last} />
            <div className="flex gap-2">
              <Button variant="primary" size="lg" href={`/company/${company._id}/acquire`} className="flex-1">
                Acquire
              </Button>
              <Button size="lg" href="/overview" className="flex-1">
                Portfolio
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
            {live ? (
              <>
                <Participants book={m.book} latest={priced.at(-1) ?? null} justCleared={m.justCleared} pending={m.pending} />
                <PricePath batches={m.batches} refPrice={ref} selected={selected} onSelect={setSelected} />
                <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                  <RoundFigure batch={selectedBatch} modelPrice={ref} />
                  <DepthPlate book={m.book} tick={m.tick} last={m.last} pending={m.pending} />
                </div>
                <OrderBook book={m.book} last={m.last} tick={m.tick} dir={m.dir} changed={m.changed} />
              </>
            ) : null}
            <Sources sources={company.sources} />
            <Evidence facts={company.evidence ?? []} />
          </div>
        </div>
      </div>
    </>
  );
}
