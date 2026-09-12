"use client";

import { useEffect, useState } from "react";
import { Check, Database, MapPinned, Radar, ScanSearch } from "lucide-react";

import type { SearchIntent } from "@contracts/types";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import "./landing.css";

type Activity = { phase: string; message: string; t: number };

function readable(value: string | null | undefined) {
  if (!value || value === "default") return "local businesses";
  return value.replaceAll("_", " ");
}

export function SearchProgress({
  q,
  intent,
  activity,
  found,
  cached,
}: {
  q: string;
  intent: SearchIntent | null;
  activity: Activity[];
  found: number;
  cached?: boolean;
}) {
  const city = intent?.city || intent?.state || "target markets";
  const category = readable(intent?.category);
  const target = found > 0 ? 3 : intent ? 2 : activity.length ? 1 : 0;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setProgress(0), 0);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (progress >= target) return;
    const wait = window.setTimeout(() => setProgress((n) => Math.min(target, n + 1)), 1400);
    return () => window.clearTimeout(wait);
  }, [progress, target]);
  const stages = [
    { label: "Reading your search", icon: ScanSearch },
    { label: `Looking across ${city}`, icon: MapPinned },
    { label: `Finding ${category}`, icon: Radar },
    { label: cached ? "Loading saved research" : "Checking business records", icon: Database },
  ];
  const latest = activity.at(-1)?.message;

  return (
    <div className="relative mb-8 overflow-hidden border border-accent/25 bg-card">
      <div className="bl-search-scan pointer-events-none absolute inset-x-0 top-0 h-px bg-accent/60" />
      <div className="grid min-h-56 md:grid-cols-[220px_1fr]">
        <div className="relative flex min-h-44 items-center justify-center overflow-hidden border-b border-line bg-primary md:min-h-full md:border-b-0 md:border-r">
          <div className="absolute size-36 border border-white/10" />
          <div className="absolute size-24 rotate-45 border border-white/15" />
          <div className="bl-search-orbit relative size-20 border border-accent/70">
            <span className="absolute left-1/2 top-0 h-1/2 w-px origin-bottom bg-gradient-to-t from-accent to-transparent" />
            <span className="absolute -right-1 -top-1 size-2 bg-teal" />
          </div>
          <span className="absolute size-2 bg-white" />
          <span className="absolute bottom-4 left-4 font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
            Discovery active
          </span>
        </div>

        <div className="p-5 md:p-7">
          <Label className="mb-2 block">{cached ? "Saved search" : "Live discovery"}</Label>
          <h2 className="max-w-2xl text-[24px] leading-[1.18] md:text-[30px]">
            {latest || `Looking at places and finding options for “${q}”`}
          </h2>

          <ol className="mt-7 grid gap-px bg-line sm:grid-cols-2">
            {stages.map((stage, index) => {
              const complete = index < progress;
              const active = index === progress;
              const Icon = stage.icon;
              return (
                <li
                  key={stage.label}
                  className={cn(
                    "flex min-h-16 items-center gap-3 bg-background px-4 py-3 transition-colors duration-300",
                    active && "bg-accent/[0.06]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center border",
                      complete
                        ? "border-up/40 bg-up/[0.08] text-up"
                        : active
                          ? "border-accent/40 bg-accent/[0.08] text-accent"
                          : "border-line text-muted-foreground",
                    )}
                  >
                    {complete ? <Check className="size-3.5" /> : <Icon className={cn("size-3.5", active && "animate-pulse")} />}
                  </span>
                  <span className={cn("text-[13px]", active ? "text-foreground" : "text-muted-foreground")}>
                    {stage.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
