"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Flag, Severity } from "@contracts/types";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getFlags } from "@/lib/api";
import { clock } from "@/lib/format";

const tone = (severity: Severity): "down" | "accent" | "neutral" =>
  severity === "high" ? "down" : severity === "medium" ? "accent" : "neutral";

export function SurveillanceDashboard() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getFlags()
      .then((result) => {
        if (active) setFlags(result);
      })
      .catch(() => {
        if (active) setError("Surveillance is unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);

  if (!flags) {
    return (
      <div>
        <div className="pt-10 pb-6">
          <Label className="mb-2 block">Admin</Label>
          <h1 className="text-[30px] leading-[1.1] md:text-[40px]">Surveillance</h1>
        </div>
        {error ? (
          <p role="alert" className="border-y border-line py-5 text-[14px] text-down">
            {error}
          </p>
        ) : (
          <div className="space-y-px bg-line">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-24 bg-background" />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="pt-10 pb-6">
        <Label className="mb-2 block">Admin</Label>
        <h1 className="text-[30px] leading-[1.1] md:text-[40px]">Surveillance</h1>
      </div>

      <div className="grid grid-cols-3 divide-x divide-line border-y border-line">
        {[
          ["Flags", flags.length],
          ["High", flags.filter((flag) => flag.severity === "high").length],
          ["Disputed", flags.filter((flag) => flag.disputed).length],
        ].map(([key, value]) => (
          <div key={String(key)} className="px-4 py-4">
            <Label tracking="tight" className="mb-1 block">
              {key}
            </Label>
            <div className="text-[24px] leading-none tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <ol className="flex flex-col py-6 pb-20">
        {flags.map((flag) => (
          <li
            key={flag._id}
            className="grid gap-3 border-b border-hairline py-5 md:grid-cols-[180px_1fr]"
          >
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] tabular-nums text-tint-400">
                {flag._id.toUpperCase()}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {clock(flag.t)}
              </span>
              <Link
                href={`/company/${flag.market_id}`}
                className="font-mono text-[11px] text-accent-deep underline decoration-accent-deep/40 underline-offset-[0.15em]"
              >
                {flag.market_id}
              </Link>
              <span className="font-mono text-[11px] text-muted-foreground">
                {flag.batch_id}
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={tone(flag.severity)}>{flag.rule.replace(/_/g, " ")}</Chip>
                <Chip tone={tone(flag.severity)}>{flag.severity}</Chip>
                {flag.disputed ? <Chip tone="accent">disputed</Chip> : null}
                <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {flag.subjects.join(", ")}
                </span>
              </div>
              <p className="mt-3 max-w-[72ch] text-[16px]">{flag.explanation}</p>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px]">
                {flag.reviews.map((review) => (
                  <div key={review.reviewer} className="flex gap-2">
                    <dt className="uppercase tracking-[0.08em] text-muted-foreground">
                      {review.reviewer}
                    </dt>
                    <dd
                      className={
                        review.severity === "high"
                          ? "text-down"
                          : review.severity === "medium"
                            ? "text-accent"
                            : "text-foreground"
                      }
                    >
                      {review.severity}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
