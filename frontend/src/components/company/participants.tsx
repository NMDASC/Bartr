"use client";

import type { Batch, Book, Participant } from "@contracts/types";
import { px } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

/**
 * Who is in the round. Anonymous by design: a stable word and number per account, never a name.
 * While the clock runs, the people with sealed orders. When it clears, who traded and at what.
 */
function initials(alias: string) {
  const [w, n] = alias.split(" ");
  return alias === "Owner" ? "OW" : `${w[0]}${n ?? ""}`.slice(0, 3);
}

function Person({ p, you, filled, price }: { p: Participant; you: boolean; filled?: boolean; price?: number | null }) {
  const buy = p.side === "buy";
  return (
    <li className="relative flex flex-col items-center gap-1 w-[76px] shrink-0 fade-up" title={`${p.alias}: ${p.side} ${p.qty}`}>
      <span
        className={cn(
          "grid place-items-center h-11 w-11 border font-mono text-[11px] tabular-nums transition-colors duration-200",
          filled ? (buy ? "border-up bg-up/[0.10] text-up" : "border-down bg-down/[0.10] text-down") : buy ? "border-up/60 text-up" : "border-down/60 text-down",
          you && "outline outline-1 outline-offset-2 outline-accent",
        )}
        aria-hidden
      >
        {initials(p.alias)}
      </span>
      <span className="font-mono text-[10px] text-foreground leading-tight">{you ? "You" : p.alias}</span>
      <span className={cn("font-mono text-[10px] tabular-nums leading-tight", buy ? "text-up" : "text-down")}>
        {buy ? "buy" : "sell"} {p.qty}{filled && price ? ` @ ${px(price)}` : ""}
      </span>
    </li>
  );
}

export function Participants({ book, latest, justCleared, pending, quietRound = false, round, last }: { book: Book | null; latest: Batch | null; justCleared: boolean; pending: number; quietRound?: boolean; round?: number; last?: number | null }) {
  const you = book?.you ?? null;
  const sealed = book?.participants ?? [];
  const fills = latest?.fills ?? [];
  const showFills = justCleared && fills.length > 0;
  const list = showFills ? fills : sealed;
  const n = sealed.length;

  return (
    <section className="bg-card border border-line">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <Label>{showFills ? `Round ${latest?.round ?? ""} traded` : "Who is in the round"}</Label>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {showFills
            ? `${fills.length} filled at ${px(latest?.clearing_price)}`
            : `carried over ${n}${pending > 0 ? ` · new this round ${pending}` : ""}`}
        </span>
      </div>
      {quietRound && !showFills ? (
        <p className="px-3 pt-2.5 -mb-1 font-mono text-[11px] text-muted-foreground tabular-nums">
          Round {round ? round - 1 : ""}: no bid met an ask, nothing traded, the price holds at {px(last)}.
        </p>
      ) : null}
      {list.length ? (
        <ul className="flex gap-2 overflow-x-auto px-3 py-3">
          {list.slice(0, 14).map((p) => (
            <Person key={`${p.uid_hash}-${p.side}`} p={p} you={you !== null && p.uid_hash === you} filled={showFills} price={showFills ? latest?.clearing_price : undefined} />
          ))}
          {list.length > 14 ? <li className="self-center font-mono text-[10px] text-muted-foreground">+{list.length - 14}</li> : null}
        </ul>
      ) : (
        <p className="px-3 py-4 text-[13px] secondary">No orders carried into this round. The owner&rsquo;s quotes are always in.</p>
      )}
    </section>
  );
}
