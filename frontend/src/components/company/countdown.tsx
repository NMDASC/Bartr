"use client";

import { useCountdown } from "@/hooks/use-market";
import { cn } from "@/lib/cn";

/** The clock the whole page runs on, so it is sized like one. */
export function Countdown({
  nextBatchAt,
  interval = 10,
  className,
}: {
  nextBatchAt: string | null | undefined;
  interval?: number;
  className?: string;
}) {
  const s = useCountdown(nextBatchAt) ?? 0;
  const remaining = Math.min(1, Math.max(0, s / interval));
  const imminent = s <= 3;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="flex flex-col items-end gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Next batch</span>
        <span
          className={cn(
            "font-mono text-[28px] leading-none tabular-nums transition-colors duration-150 ease-out",
            imminent ? "text-accent bartr-imminent" : "text-foreground",
          )}
        >
          {s.toFixed(1)}
          <span className="text-[15px] text-muted-foreground">s</span>
        </span>
      </div>
      <span className="relative block h-10 w-1.5 overflow-hidden bg-tint-300/60" aria-hidden>
        <span
          className={cn("absolute inset-x-0 bottom-0 transition-[height] duration-100 ease-linear", imminent ? "bg-accent" : "bg-primary")}
          style={{ height: `${remaining * 100}%` }}
        />
      </span>
      <span className="sr-only" aria-live="off">
        {s.toFixed(0)} seconds to the next batch
      </span>
    </div>
  );
}
