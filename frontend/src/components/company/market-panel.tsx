"use client";

import type { Company } from "@contracts/types";
import { useMarket } from "@/hooks/use-market";
import { px, signed, usd } from "@/lib/format";
import { Countdown } from "./countdown";
import { PriceChart } from "./price-chart";
import { OrderBook } from "./order-book";
import { DepthPlate } from "./depth-plate";
import { OrderTicket } from "./order-ticket";
import { Valuation } from "./valuation";
import { Sources } from "./sources";
import { Evidence } from "./evidence";
import { OfferPanel } from "./offer-panel";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function MarketPanel({ company }: { company: Company }) {
  const listed = company.listed !== false;
  const live = company.status === "ready" && listed;
  const m = useMarket(company._id, live);

  const shares = company.market?.shares_outstanding ?? 10000;
  const ref = company.valuation ? company.valuation.v0 / shares : null;
  const change = m.last !== null && m.prev !== null ? m.last - m.prev : null;
  const lastPrint = m.tick > 0 ? m.batches.at(-1) : null;

  return (
    <>
      {/* price strip */}
      <div className="border-t border-b border-line">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 py-4">
            <div className="flex items-end gap-6">
              <div>
                <Label tracking="tight" className="block mb-1">{listed ? "Last clearing price" : "Our estimate, per share"}</Label>
                <div key={m.tick} className={cn("text-[40px] leading-none tabular-nums px-1 -mx-1", m.tick > 0 && "bartr-clear")}>{listed ? px(m.last) : px(ref)}</div>
              </div>
              <div className="pb-1">
                <Label tracking="tight" className="block mb-1">Change</Label>
                <div
                  key={`chg-${m.tick}`}
                  className={cn(
                    "font-mono text-[14px] tabular-nums px-1 -mx-1",
                    change === null ? "text-muted-foreground" : change >= 0 ? "text-up" : "text-down",
                    m.dir === "up" ? "bartr-up" : m.dir === "down" ? "bartr-down" : "",
                  )}
                >
                  {change === null ? "\u2014" : signed(change)}
                </div>
              </div>
              <div className="pb-1 hidden sm:block">
                <Label tracking="tight" className="block mb-1">Implied value</Label>
                <div className="font-mono text-[14px] tabular-nums">{m.last !== null ? usd(m.last * shares, { compact: true }) : "\u2014"}</div>
              </div>
              <div className="pb-1 hidden lg:block">
                <Label tracking="tight" className="block mb-1">Owner float</Label>
                <div className="font-mono text-[14px] tabular-nums">
                  {company.market?.treasury ? `${company.market.treasury.unsold_float} unsold · floor ${px(company.market.treasury.floor_price)}` : "\u2014"}
                </div>
              </div>
            </div>
            {live ? <Countdown nextBatchAt={m.book?.next_batch_at} interval={company.market?.batch_interval_s ?? 10} /> : <Label>{listed ? "Not priced yet" : "Not on the exchange"}</Label>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-6 xl:border-l xl:border-r xl:border-line">
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* right rail first on mobile so judges can bid without scrolling */}
          <div className="flex flex-col gap-4 order-first lg:order-none lg:col-start-2">
            {live ? <OrderTicket marketId={company._id} book={m.book} /> : null}
            {!listed ? <OfferPanel company={company} /> : null}
            <Valuation company={company} last={m.last} />
            <div className="flex gap-2">
              <Button variant="primary" size="lg" href={`/company/${company._id}/acquire`} className="flex-1">
                Acquire
              </Button>
              <Button size="lg" href="/portfolio" className="flex-1">
                Portfolio
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
            <div className="bg-card border border-line">
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
                <Label>Clearing price by batch</Label>
                {lastPrint ? (
                  <span
                    key={m.tick}
                    className={cn(
                      "bartr-print font-mono text-[11px] tabular-nums",
                      m.dir === "up" ? "text-up" : m.dir === "down" ? "text-down" : "text-muted-foreground",
                    )}
                  >
                    {lastPrint.volume > 0 ? (
                      <>
                        {m.dir === "up" ? "\u25b2" : m.dir === "down" ? "\u25bc" : "\u25cf"} {px(lastPrint.clearing_price)} × {lastPrint.volume}
                      </>
                    ) : (
                      <span className="text-muted-foreground">{px(lastPrint.clearing_price)} · no trade</span>
                    )}
                  </span>
                ) : null}
              </div>
              {live ? <PriceChart batches={m.batches} refPrice={ref} dir={m.dir} /> : <div className="h-[260px]" />}
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <OrderBook book={m.book} last={m.last} tick={m.tick} dir={m.dir} changed={m.changed} />
              <DepthPlate book={m.book} tick={m.tick} last={m.last} />
            </div>
            <Sources sources={company.sources} />
            <Evidence facts={company.evidence ?? []} />
          </div>
        </div>
      </div>
    </>
  );
}
