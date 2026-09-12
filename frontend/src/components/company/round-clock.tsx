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
  const imminent = s <= 3;
  const secs = Math.ceil(s);

  return (
    <div className="flex flex-col gap-2 min-w-[240px]" role="timer" aria-live="off">
      <div className="flex items-end justify-between gap-6">
        <div>
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Round {round + 1}</span>
          <span className="block text-[13px] secondary mt-0.5">
            {pending > 0 ? `${pending} ${pending === 1 ? "order" : "orders"} sealed for this round` : "Orders seal when the clock hits zero"}
          </span>
        </div>
        <div className="text-right">
          <span
            className={cn(
              "block font-mono text-[56px] leading-[0.9] tabular-nums transition-colors duration-150 ease-out",
              justCleared ? "text-up" : imminent ? "text-accent" : "text-foreground",
            )}
          >
            {justCleared ? "0" : secs}
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
            {justCleared ? "cleared" : "seconds to clear"}
          </span>
        </div>
      </div>
      <div className="relative h-1.5 w-full bg-tint-300/60 overflow-hidden" aria-hidden>
        <div
          className={cn("absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear", justCleared ? "bg-up" : imminent ? "bg-accent" : "bg-primary")}
          style={{ width: `${(justCleared ? 1 : remaining) * 100}%` }}
        />
      </div>
      <span className="sr-only">{secs} seconds until round {round + 1} clears</span>
    </div>
  );
}
