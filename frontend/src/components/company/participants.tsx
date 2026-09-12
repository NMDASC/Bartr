"use client";

import type { Book, Participant } from "@contracts/types";
import type { MarketArrival } from "@/hooks/use-market";
import { bidderInitials, bidderLabel } from "@/lib/bidder";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

function Person({
  p,
  you,
  arrival,
}: {
  p: Participant;
  you: boolean;
  arrival?: MarketArrival;
}) {
  const buy = p.side === "buy";
  const label = you ? "You" : bidderLabel(p, null);
  return (
    <li className="relative flex w-[92px] shrink-0 flex-col items-center gap-1.5 fade-up">
      <span
        className={cn(
          "grid size-16 place-items-center border font-mono text-[16px] tabular-nums",
          buy ? "border-up/50 text-up" : "border-down/50 text-down",
          you && "outline outline-1 outline-offset-2 outline-accent",
          Boolean(arrival) && (buy ? "bg-up/[0.12]" : "bg-down/[0.12]"),
        )}
        aria-hidden
      >
        {bidderInitials(label)}
      </span>
      <span className="font-mono text-[12px] leading-tight text-foreground">{label}</span>
    </li>
  );
}

export function Participants({
  book,
  arrivals = [],
}: {
  book: Book | null;
  arrivals?: MarketArrival[];
}) {
  const you = book?.you ?? null;
  const seated = book?.participants ?? [];

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <Label>In this round</Label>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{seated.length}</span>
      </div>
      {seated.length ? (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {seated.slice(0, 9).map((p) => (
            <Person
              key={`${p.uid_hash}-${p.side}`}
              p={p}
              you={you !== null && p.uid_hash === you}
              arrival={arrivals.find((a) => a.uid_hash === p.uid_hash && a.side === p.side)}
            />
          ))}
        </ul>
      ) : (
        <p className="py-2 font-mono text-[12px] text-muted-foreground">Owner quoting</p>
      )}
    </section>
  );
}
