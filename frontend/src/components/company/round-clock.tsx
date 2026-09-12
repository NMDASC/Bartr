"use client";

import { useCountdown } from "@/hooks/use-market";
import { cn } from "@/lib/cn";

/**
 * The clock the whole page runs on. Round number, seconds to the next clear, and a bar that
 * drains across the full width of the strip so it reads from across a room.
 */
export function RoundClock({
  round,
  nextBatchAt,
  interval = 10,
  pending = 0,
  justCleared = false,
}: {
  round: number;
  nextBatchAt: string | null | undefined;
  interval?: number;
  pending?: number;
  justCleared?: boolean;
}) {
  const s = useCountdown(nextBatchAt);
  const remaining = Math.min(1, Math.max(0, s / interval));
  const imminent = s <= 3 && !justCleared;
  const secs = Math.ceil(s);

  return (
    <div className="flex flex-col gap-2 w-full lg:w-[320px]" role="timer" aria-live="off">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Round {round}</span>
          <span className="block text-[13px] secondary mt-0.5">
            {pending > 0 ? `${pending} new ${pending === 1 ? "order" : "orders"} in for this round` : "One price for everyone when the clock hits zero"}
          </span>
        </div>
        <div className="text-right shrink-0 w-[96px]">
          <span
            className={cn(
              "block font-mono text-[56px] leading-[0.9] tabular-nums transition-colors duration-150 ease-out",
              justCleared ? "text-up" : imminent ? "text-accent" : "text-foreground",
            )}
          >
            {secs}
          </span>
          <span className={cn("block font-mono text-[10px] uppercase tracking-[0.12em] mt-1", justCleared ? "text-up" : "text-muted-foreground")}>
            {justCleared ? "cleared" : secs === 1 ? "second to clear" : "seconds to clear"}
          </span>
        </div>
      </div>
      <div className="relative h-1.5 w-full bg-tint-300/60 overflow-hidden" aria-hidden>
        <div
          className={cn("absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear", justCleared ? "bg-up" : imminent ? "bg-accent" : "bg-primary")}
          style={{ width: `${remaining * 100}%` }}
        />
      </div>
      <span className="sr-only">{secs} {secs === 1 ? "second" : "seconds"} until round {round} clears</span>
    </div>
  );
}
