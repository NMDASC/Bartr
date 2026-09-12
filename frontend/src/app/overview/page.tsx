import Link from "next/link";
import { cookies } from "next/headers";

import type { Portfolio, Suggestion } from "@contracts/types";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";
import { getPortfolio, suggestPortfolio } from "@/lib/api";
import { px, signed, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

const STARTERS = ["laundromat in Pittsburgh", "car wash in Waco", "machine shop in McKees Rocks"];

/** Header bar for a ruled panel. Panels hold records; plates hold figures. */
function PanelHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
      <Label tracking="normal">{title}</Label>
      {meta ? <span className="font-mono text-[10px] uppercase tracking-[0.1em] tabular-nums text-tint-400">{meta}</span> : null}
    </div>
  );
}

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);

  // through lib/api, like every other screen, so this page follows
  // NEXT_PUBLIC_API_URL instead of serving fixtures forever
  const empty: Portfolio = { cash: 0, pnl: { realized: 0, unrealized: 0, total: 0 }, positions: [] };
  const [portfolio, recommendations] = await Promise.all([
    getPortfolio(session?.email).catch(() => empty),
    suggestPortfolio(session?.email).catch((): Suggestion[] => []),
  ]);

  const equity = portfolio.positions.reduce((sum, p) => sum + p.value, 0);
  const basis = portfolio.positions.reduce((sum, p) => sum + p.qty * p.avg_cost, 0);

  const stats: [string, string, "up" | "down" | null][] = [
    ["Cash", usd(portfolio.cash), null],
    ["Equity", usd(equity), null],
    ["Total P&L", signed(portfolio.pnl.total), portfolio.pnl.total >= 0 ? "up" : "down"],
    ["Positions", String(portfolio.positions.length), null],
  ];

  const ledger: [string, string, "up" | "down" | null][] = [
    ["Cost basis", usd(basis), null],
    ["Market value", usd(equity), null],
    ["Unrealized", signed(portfolio.pnl.unrealized), portfolio.pnl.unrealized >= 0 ? "up" : "down"],
    ["Realized", signed(portfolio.pnl.realized), portfolio.pnl.realized >= 0 ? "up" : "down"],
  ];

  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 pb-20 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="flex items-end justify-between gap-6 pt-10 pb-6">
        <div>
          <Label className="mb-2 block">Account overview</Label>
          <h1 className="text-[33px] leading-[1.1] tracking-[-0.01em] md:text-[40px] 3xl:text-[48px]">{session?.name || "Investor"}</h1>
        </div>
        {/* an address is data, not a label, so it keeps its own case */}
        {session?.email ? <span className="font-mono text-[11px] text-tint-500">{session.email}</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-line bg-line md:grid-cols-4">
        {stats.map(([label, value, tone]) => (
          <div key={label} className="bg-background px-4 py-4">
            <Label tracking="tight" className="mb-1 block">
              {label}
            </Label>
            <div
              className={`text-[24px] leading-none tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid items-stretch gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col border border-line bg-background">
          <PanelHead title="Positions" meta={`${portfolio.positions.length} held`} />
          <ul className="flex-1 divide-y divide-line">
            {portfolio.positions.map((position) => (
              <li key={position.market_id}>
                <Link
                  href={`/company/${position.market_id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 transition-colors duration-150 ease-out hover:bg-surface"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[16px]">{position.name}</div>
                    <div className="text-[13px] secondary tabular-nums">
                      {position.qty} shares at {px(position.avg_cost)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[13px] tabular-nums">{usd(position.value)}</div>
                    <div
                      className={`font-mono text-[11px] tabular-nums ${position.pnl >= 0 ? "text-up" : "text-down"}`}
                    >
                      {signed(position.pnl)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {portfolio.positions.length === 0 ? (
              <li className="px-4 py-4 text-[14px] secondary">No positions yet.</li>
            ) : null}
          </ul>
          <div className="mt-auto border-t border-line px-4 py-3">
            <Link
              href="/portfolio"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors duration-150 ease-out hover:text-accent"
            >
              View portfolio
            </Link>
          </div>
        </section>

        <section className="flex flex-col border border-line bg-background">
          <PanelHead title="Profit and loss" />
          <dl className="flex-1 divide-y divide-line">
            {ledger.map(([label, value, tone]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-4">
                <dt className="text-[14px] secondary">{label}</dt>
                <dd
                  className={`font-mono text-[14px] tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto border-t border-line px-4 py-3">
            <Link
              href="/agent"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors duration-150 ease-out hover:text-accent"
            >
              Open agent
            </Link>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <Label>Recommended</Label>
          <Link
            href="/search?q=laundromat%20in%20Pittsburgh"
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors duration-150 ease-out hover:text-accent"
          >
            Discover
          </Link>
        </div>
        <div className="grid gap-px border-y border-line bg-line md:grid-cols-2">
          {recommendations.map((suggestion) => (
            <Link
              key={suggestion.company._id}
              href={`/company/${suggestion.company._id}`}
              className="bg-background p-5 transition-colors duration-150 ease-out hover:bg-surface"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-[18px]">{suggestion.company.name}</h2>
                  <div className="text-[13px] secondary">
                    {suggestion.company.city}, {suggestion.company.state}
                  </div>
                </div>
                {/* a size is a number; watch is a state, so only one of them is a chip */}
                {suggestion.suggested_usd > 0 ? (
                  <span className="shrink-0 font-mono text-[13px] tabular-nums">
                    {usd(suggestion.suggested_usd, { cents: false })}
                  </span>
                ) : (
                  <Chip>Watch</Chip>
                )}
              </div>
              <p className="mt-4 text-[14px] leading-[1.45] secondary">{suggestion.why}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 border-t border-line pt-6">
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
