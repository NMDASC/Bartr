import Link from "next/link";
import { cookies } from "next/headers";

import portfolioFixture from "@contracts/examples/portfolio.json";
import suggestionsFixture from "@contracts/examples/suggest.json";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import { Plate } from "@/components/ui/plate";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";
import { signed, usd } from "@/lib/format";

const activity = [
  { action: "Search completed", detail: "12 Pittsburgh laundromats ranked", time: "2m" },
  { action: "Portfolio reviewed", detail: "Two positions remain inside risk limits", time: "18m" },
  { action: "Market watched", detail: "Squirrel Hill Wash and Fold", time: "41m" },
];

const requests = [
  "laundromats in Pittsburgh",
  "owner-operated businesses under $750K",
  "stable cash flow near universities",
];

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);
  const portfolio = portfolioFixture;
  const recommendations = suggestionsFixture;
  const equity = portfolio.positions.reduce((sum, position) => sum + position.value, 0);

  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 pb-20 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="flex items-end justify-between gap-6 pt-10 pb-6">
        <div>
          <Label className="mb-2 block">Account overview</Label>
          <h1 className="text-[30px] leading-[1.1] md:text-[40px]">
            {session?.name || "Investor"}
          </h1>
        </div>
        <Label tracking="tight">{session?.email}</Label>
      </div>

      <div className="grid grid-cols-2 border-y border-line md:grid-cols-4 md:divide-x md:divide-line">
        {[
          ["Cash", usd(portfolio.cash)],
          ["Equity", usd(equity)],
          ["Total P&L", signed(portfolio.pnl.total)],
          ["Positions", String(portfolio.positions.length)],
        ].map(([label, value], index) => (
          <div
            key={label}
            className="border-b border-line px-4 py-4 even:border-l md:border-b-0 md:border-l-0"
          >
            <Label tracking="tight" className="mb-1 block">
              {label}
            </Label>
            <div
              className={
                index === 2
                  ? `text-[24px] leading-none tabular-nums ${
                      value.startsWith("-") ? "text-down" : "text-up"
                    }`
                  : "text-[24px] leading-none tabular-nums"
              }
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <Plate id="Portfolio" caption={`${portfolio.positions.length} positions`}>
          <ul>
            {portfolio.positions.map((position) => (
              <li key={position.market_id} className="border-b border-hairline last:border-b-0">
                <Link
                  href={`/company/${position.market_id}`}
                  className="grid grid-cols-[1fr_auto] gap-4 px-4 py-4 transition-colors hover:bg-surface"
                >
                  <div>
                    <div className="text-[15px]">{position.name}</div>
                    <Label tracking="tight">{position.qty} shares</Label>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[13px] tabular-nums">
                      {usd(position.value)}
                    </div>
                    <div
                      className={`font-mono text-[11px] tabular-nums ${
                        position.pnl >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {signed(position.pnl)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-3">
            <Link
              href="/portfolio"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent-deep"
            >
              View portfolio
            </Link>
          </div>
        </Plate>

        <Plate id="Agent activity" caption="Recent">
          <ol>
            {activity.map((item) => (
              <li
                key={`${item.action}-${item.time}`}
                className="grid grid-cols-[1fr_auto] gap-4 border-b border-hairline px-4 py-4 last:border-b-0"
              >
                <div>
                  <div className="text-[14px]">{item.action}</div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{item.detail}</p>
                </div>
                <Label tracking="tight">{item.time}</Label>
              </li>
            ))}
          </ol>
          <div className="border-t border-line px-4 py-3">
            <Link
              href="/agent"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent-deep"
            >
              Open agent
            </Link>
          </div>
        </Plate>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <Label>Recommended</Label>
          <Link
            href="/search"
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent-deep"
          >
            Discover
          </Link>
        </div>
        <div className="grid gap-px bg-line md:grid-cols-2">
          {recommendations.map((suggestion) => (
            <Link
              key={suggestion.company._id}
              href={`/company/${suggestion.company._id}`}
              className="bg-background p-5 transition-colors hover:bg-surface"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px]">{suggestion.company.name}</h2>
                  <Label tracking="tight">
                    {suggestion.company.city}, {suggestion.company.state}
                  </Label>
                </div>
                <Chip tone="accent">
                  {suggestion.suggested_usd > 0
                    ? usd(suggestion.suggested_usd, { cents: false })
                    : "Watch"}
                </Chip>
              </div>
              <p className="mt-4 text-[14px] leading-[1.45] text-muted-foreground">
                {suggestion.why}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 border-t border-line pt-6">
        <Label className="mb-3 block">Previous requests</Label>
        <div className="flex flex-wrap gap-2">
          {requests.map((request) => (
            <Link
              key={request}
              href={`/search?q=${encodeURIComponent(request)}`}
              className="bg-surface px-3 py-2 font-mono text-[11px] text-foreground transition-colors hover:bg-surface-hover"
            >
              {request}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
