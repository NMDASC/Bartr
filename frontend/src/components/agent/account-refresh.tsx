"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IS_MOCK } from "@/lib/api";

/**
 * Re-runs this route's server components on an interval, so an order placed
 * over the iMessage line lands in the figures and the positions ledger without
 * the reader touching anything.
 *
 * `router.refresh()` rather than a client fetch because the numbers on this page
 * are server rendered from one identity. Refreshing keeps that single source and
 * preserves client state, so the stake slider does not jump while it polls.
 */
export function AccountRefresh({ intervalMs = 6000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (IS_MOCK) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(poll);
  }, [router, intervalMs]);

  return null;
}
