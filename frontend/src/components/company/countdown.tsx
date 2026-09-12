"use client";

import { useCountdown } from "@/hooks/use-market";
import { cn } from "@/lib/cn";

export function Countdown({ nextBatchAt, interval = 10, className }: { nextBatchAt: string | null | undefined; interval?: number; className?: string }) {
  const s = useCountdown(nextBatchAt);
  const frac = Math.min(1, Math.max(0, s / interval));
  return (
    <div className={cn("flex items-center gap-3", className)} aria-live="off">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Next batch</span>
      <span className="font-mono text-[13px] tabular-nums text-foreground w-10">{s.toFixed(1)}s</span>
      <span className="relative h-px w-24 bg-tint-300" aria-hidden>
        <span className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-100 ease-linear" style={{ width: `${(1 - frac) * 100}%`, height: 1 }} />
      </span>
    </div>
  );
}
