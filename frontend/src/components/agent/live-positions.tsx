"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Portfolio } from "@contracts/types";
import { API_URL, IS_MOCK, demoUser } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { px, qty, signed, usd } from "@/lib/format";

/**
 * The account the agent is acting on, kept current while this page is open, so
 * an order texted to the line shows up here without a reload. The API keys the
 * account off the identity header, which is the paired number when there is
 * one, so a phone order and this table are the same account.
 */
const POLL_MS = 4000;

const EMPTY: Portfolio = {
  cash: 0,
  pnl: { realized: 0, unrealized: 0, total: 0 },
  positions: [],
};

export function LivePositions({ className, userId }: { className?: string; userId?: string }) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const seen = useRef<Map<string, number>>(new Map());
  const [moved, setMoved] = useState<Set<string>>(new Set());

  const read = useCallback(async () => {
    if (IS_MOCK) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/portfolio`, {
        headers: { "x-demo-user": userId || demoUser() },
        cache: "no-store",
      });
      if (!res.ok) return;
      const next = (await res.json()) as Portfolio;

      // Mark the rows whose share count actually changed since the last read.
      // The cause is nameable: a fill landed. Rows that only revalued are not marked.
      const changed = new Set<string>();
      for (const p of next.positions) {
        const before = seen.current.get(p.market_id);
        if (before !== undefined && before !== p.qty) changed.add(p.market_id);
        seen.current.set(p.market_id, p.qty);
      }
      setPortfolio(next);
      if (changed.size) {
        setMoved(changed);
        setTimeout(() => setMoved(new Set()), 2200);
      }
    } catch {
      // Keep the last good reading rather than blanking the table.
    }
  }, [userId]);

  useEffect(() => {
    if (IS_MOCK) return;
    const first = setTimeout(() => void read(), 0);
    const poll = setInterval(read, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
    };
  }, [read]);

  const p = portfolio ?? EMPTY;
  const equity = p.positions.reduce((sum, row) => sum + row.value, 0);

  return (
    <section className={cn("border-t border-line", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-4">
        <Label>Account</Label>
        <div className="flex items-baseline gap-6">
          <div className="flex items-baseline gap-2">
            <Label tracking="tight">cash</Label>
            <span className="font-mono text-[13px] tabular-nums">{usd(p.cash)}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <Label tracking="tight">equity</Label>
            <span className="font-mono text-[13px] tabular-nums">{usd(equity)}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <Label tracking="tight">total</Label>
            <span
              className={cn(
                "font-mono text-[13px] tabular-nums",
                p.pnl.total > 0 ? "text-up" : p.pnl.total < 0 ? "text-down" : "",
              )}
            >
              {signed(p.pnl.total)}
            </span>
          </div>
        </div>
      </div>

      {p.positions.length ? (
        <table className="w-full border-t border-line text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 text-left font-normal"><Label as="span" tracking="tight">business</Label></th>
              <th className="py-2 text-right font-normal"><Label as="span" tracking="tight">shares</Label></th>
              <th className="py-2 text-right font-normal"><Label as="span" tracking="tight">avg cost</Label></th>
              <th className="py-2 text-right font-normal"><Label as="span" tracking="tight">last</Label></th>
              <th className="py-2 text-right font-normal"><Label as="span" tracking="tight">value</Label></th>
              <th className="py-2 text-right font-normal"><Label as="span" tracking="tight">p&amp;l</Label></th>
            </tr>
          </thead>
          <tbody>
            {p.positions.map((row) => (
              <tr
                key={row.market_id}
                className={cn(
                  "border-b border-line/60 transition-colors duration-500 ease-out",
                  moved.has(row.market_id) && (row.pnl >= 0 ? "bg-up/[0.09]" : "bg-down/[0.09]"),
                )}
              >
                <td className="py-2 pr-4">{row.name}</td>
                <td className="py-2 text-right font-mono tabular-nums">{qty(row.qty)}</td>
                <td className="py-2 text-right font-mono tabular-nums">{px(row.avg_cost)}</td>
                <td className="py-2 text-right font-mono tabular-nums">{px(row.last)}</td>
                <td className="py-2 text-right font-mono tabular-nums">{usd(row.value)}</td>
                <td
                  className={cn(
                    "py-2 text-right font-mono tabular-nums",
                    row.pnl > 0 ? "text-up" : row.pnl < 0 ? "text-down" : "",
                  )}
                >
                  {signed(row.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
