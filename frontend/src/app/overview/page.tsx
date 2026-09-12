import Link from "next/link";
import { cookies } from "next/headers";

import type { Portfolio, Suggestion } from "@contracts/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Suggestions } from "@/components/portfolio/suggestions";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";
import { getPortfolio, suggestPortfolio } from "@/lib/api";
import { cn } from "@/lib/cn";
import { px, signed, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

const STARTERS = ["laundromat in Pittsburgh", "car wash in Waco", "machine shop in McKees Rocks"];

/**
 * Hierarchy is carried by size, rules and one surface step. Nothing on this page
 * is boxed.
 *
 * Every panel used to be a 1px outlined container, which flattens the page: six
 * equally weighted frames say nothing about what to read first. So there are now
 * three tiers and only three. One dominant figure (what the account is worth),
 * one ledger (what it holds), one action (what to do next). Sections separate
 * with a hairline and a mono label, the same way the landing page does.
 */
export default async function OverviewPage() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);

  const empty: Portfolio = { cash: 0, pnl: { realized: 0, unrealized: 0, total: 0 }, positions: [] };
  const [portfolio, suggestions] = await Promise.all([
    getPortfolio(session?.email).catch(() => empty),
    suggestPortfolio(session?.email).catch((): Suggestion[] => []),
  ]);

  const equity = portfolio.positions.reduce((sum, p) => sum + p.value, 0);
  const up = portfolio.pnl.total >= 0;

  const secondary: [string, string, boolean | null][] = [
    ["Cash", usd(portfolio.cash), null],
    ["Realized", signed(portfolio.pnl.realized), portfolio.pnl.realized >= 0],
    ["Unrealized", signed(portfolio.pnl.unrealized), portfolio.pnl.unrealized >= 0],
    ["Positions", String(portfolio.positions.length), null],
  ];

  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 pb-20 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="flex items-baseline justify-between gap-6 pt-10 pb-8">
        <div>
          <Label className="mb-2 block">Account overview</Label>
          <h1 className="text-[33px] leading-[1.1] tracking-[-0.01em] md:text-[40px] 3xl:text-[48px]">
            {session?.name || "Investor"}
          </h1>
        </div>
        {session?.email ? <span className="font-mono text-[11px] text-tint-500">{session.email}</span> : null}
      </div>

      {/* tier one: the only figure that gets display scale */}
      <div className="border-t border-line pt-6">
        <Label tracking="normal" className="mb-3 block">
          Portfolio value
        </Label>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="text-[44px] leading-none tabular-nums tracking-[-0.02em] md:text-[56px] 3xl:text-[64px]">
            {usd(equity)}
          </span>
          <span className={cn("font-mono text-[16px] tabular-nums", up ? "text-up" : "text-down")}>
            {signed(portfolio.pnl.total)}
          </span>
        </div>

        {/* tier two: everything else about the account, deliberately small */}
        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 border-t border-hairline pt-5">
          {secondary.map(([label, value, positive]) => (
            <div key={label}>
              <dt>
                <Label tracking="tight">{label}</Label>
              </dt>
              <dd
                className={cn(
                  "mt-1 font-mono text-[15px] tabular-nums",
                  positive === null ? "" : positive ? "text-up" : "text-down",
                )}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="mt-12 border-t border-line pt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-[30px] leading-[1.2] md:text-[36px] 3xl:text-[44px]">Positions</h2>
          <Label tracking="tight">{portfolio.positions.length} held</Label>
        </div>

        <div className="hidden border-b border-line px-3 pb-2 md:grid md:grid-cols-[1fr_88px_96px_96px_110px_96px] md:gap-4">
          <Label>Company</Label>
          <Label className="text-right">Shares</Label>
          <Label className="text-right">Avg cost</Label>
          <Label className="text-right">Last</Label>
          <Label className="text-right">Value</Label>
          <Label className="text-right">P&amp;L</Label>
        </div>

        <ul>
          {portfolio.positions.map((p) => (
            <li key={p.market_id} className="border-b border-hairline">
              <Link
                href={`/company/${p.market_id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-3 py-3.5 transition-colors duration-150 ease-out hover:bg-surface md:grid-cols-[1fr_88px_96px_96px_110px_96px]"
              >
                <div className="min-w-0 truncate text-[16px]">{p.name}</div>
                <div className="hidden text-right font-mono text-[13px] tabular-nums md:block">{p.qty}</div>
                <div className="hidden text-right font-mono text-[13px] tabular-nums md:block">{px(p.avg_cost)}</div>
                <div className="hidden text-right font-mono text-[13px] tabular-nums md:block">{px(p.last)}</div>
                <div className="text-right font-mono text-[13px] tabular-nums">{usd(p.value)}</div>
                <div
                  className={cn(
                    "hidden text-right font-mono text-[13px] tabular-nums md:block",
                    p.pnl >= 0 ? "text-up" : "text-down",
                  )}
                >
                  {signed(p.pnl)}
                </div>
              </Link>
            </li>
          ))}
          {portfolio.positions.length === 0 ? (
            <li className="border-b border-hairline px-3 py-4 text-[14px] secondary">No positions yet.</li>
          ) : null}
        </ul>
      </section>

      {/* tier three: what to do next */}
      <section className="mt-12 border-t border-line pt-8">
        <Suggestions initial={suggestions} bankroll={portfolio.cash} />
      </section>

      <section className="mt-12 border-t border-line pt-6">
        <Label className="mb-3 block">Start a search</Label>
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((q) => (
            <Button key={q} size="sm" href={`/search?q=${encodeURIComponent(q)}`}>
              {q}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
