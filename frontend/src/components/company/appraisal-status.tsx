"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import { appraiseCompany } from "@/lib/api";

/**
 * A ready valuation without Grok's own number is not a gap in the evidence, it
 * is work that has not run yet. This asks for it once per session and shows the
 * run, then refreshes the brief when the number lands.
 */
export function AppraisalStatus({ companyId, needed }: { companyId: string; needed: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState(6);
  const started = useRef(false);

  useEffect(() => {
    if (!needed || started.current) return;
    const key = `bartr:appraise:${companyId}`;
    let asked = false;
    try {
      asked = window.sessionStorage.getItem(key) === "1";
    } catch {
      asked = false;
    }
    if (asked) return;
    started.current = true;
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      // storage is optional
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setState("running");
    });
    appraiseCompany(companyId)
      .then(() => {
        if (cancelled) return;
        setProgress(100);
        setState("done");
        window.setTimeout(() => router.refresh(), 420);
      })
      .catch(() => {
        if (!cancelled) setState("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, needed, router]);

  useEffect(() => {
    if (state !== "running") return;
    const id = window.setInterval(() => {
      setProgress((n) => (n >= 92 ? n : n + (92 - n) * 0.055));
    }, 300);
    return () => window.clearInterval(id);
  }, [state]);

  if (state === "idle") return null;

  return (
    <section aria-live="polite" className="border-t border-line bg-accent/[0.05] px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Label>Grok appraisal</Label>
        <span className="font-mono text-[11px] tabular-nums text-accent">
          {state === "done" ? "Complete" : `Researching on the web · ${Math.round(progress)}%`}
        </span>
      </div>
      <div className="mt-2 h-1 bg-tint-300">
        <div
          className="h-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}
