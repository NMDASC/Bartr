"use client";

import { useCountdown } from "@/hooks/use-market";
import { cn } from "@/lib/cn";

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
  const remaining = s === null ? 0 : Math.min(1, Math.max(0, s / interval));
  const imminent = s !== null && s <= 3 && !justCleared;
  const secs = s === null ? null : Math.ceil(s);

  return (
    <div className="flex w-full flex-col gap-2 lg:w-[280px]" role="timer" aria-live="off">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Round {round}
          </span>
          {pending > 0 ? (
            <span className="mt-1 block font-mono text-[11px] tabular-nums text-foreground">{pending} new</span>
          ) : null}
        </div>
        <div className="w-[120px] shrink-0 text-right">
          <span
            className={cn(
              "block font-mono text-[72px] leading-[0.85] tabular-nums transition-colors duration-150 ease-out",
              justCleared ? "text-up" : imminent ? "text-accent" : "text-foreground",
            )}
          >
            {secs === null ? "—" : secs}
          </span>
          <span className={cn("mt-1 block font-mono text-[10px] uppercase tracking-[0.12em]", justCleared ? "text-up" : "text-muted-foreground")}>
            {justCleared ? "cleared" : "to clear"}
          </span>
        </div>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden bg-tint-300/60" aria-hidden>
        <div
          className={cn("absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear", justCleared ? "bg-up" : imminent ? "bg-accent" : "bg-primary")}
          style={{ width: `${remaining * 100}%` }}
        />
      </div>
      <span className="sr-only">
        {secs === null ? "Waiting for the next round" : `${secs} ${secs === 1 ? "second" : "seconds"} until round ${round} clears`}
      </span>
    </div>
  );
}
