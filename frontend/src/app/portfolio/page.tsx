import Link from "next/link";
import { cookies } from "next/headers";
import { getPortfolio, suggestPortfolio } from "@/lib/api";
import { usd, px, signed } from "@/lib/format";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";
import { Label } from "@/components/ui/label";
import { Suggestions } from "@/components/portfolio/suggestions";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);
  const [pf, sug] = await Promise.all([
    getPortfolio(session?.email),
    suggestPortfolio(session?.email),
  ]);
  const equity = pf.positions.reduce((s, p) => s + p.value, 0);
  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="pt-10 pb-6">
        <h1 className="text-[30px] md:text-[40px] leading-[1.1]">Portfolio</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 border-t border-b border-line divide-x divide-line">
        {[
          ["Cash", usd(pf.cash)],
          ["Equity", usd(equity)],
          ["Realized", signed(pf.pnl.realized)],
          ["Unrealized", signed(pf.pnl.unrealized)],
        ].map(([k, v], i) => (
          <div key={k} className="px-4 py-4">
            <Label tracking="tight" className="block mb-1">{k}</Label>
            <div className={cn("text-[24px] leading-none tabular-nums", i >= 2 ? (v.startsWith("-") ? "text-down" : "text-up") : "")}>{v}</div>
          </div>
        ))}
      </div>

      <section className="py-8">
        <div className="flex items-center justify-between mb-3">
          <Label>Positions</Label>
          <Label>{pf.positions.length}</Label>
        </div>
        <div className="hidden md:grid grid-cols-[1fr_88px_96px_96px_110px_96px] gap-4 px-3 pb-2 border-b border-line">
          <Label>Company</Label>
          <Label className="text-right">Shares</Label>
          <Label className="text-right">Avg cost</Label>
          <Label className="text-right">Last</Label>
          <Label className="text-right">Value</Label>
          <Label className="text-right">P&amp;L</Label>
        </div>
        <ul>
          {pf.positions.map((p) => (
            <li key={p.market_id} className="border-b border-hairline">
              <Link
                href={`/company/${p.market_id}`}
                className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_88px_96px_96px_110px_96px] items-center gap-x-4 px-3 py-3.5 transition-colors duration-150 ease-out hover:bg-surface"
              >
                <div className="text-[16px]">{p.name}</div>
                <div className="hidden md:block font-mono text-[13px] tabular-nums text-right">{p.qty}</div>
                <div className="hidden md:block font-mono text-[13px] tabular-nums text-right">{px(p.avg_cost)}</div>
                <div className="hidden md:block font-mono text-[13px] tabular-nums text-right">{px(p.last)}</div>
                <div className="font-mono text-[13px] tabular-nums text-right">{usd(p.value)}</div>
                <div className={cn("hidden md:block font-mono text-[13px] tabular-nums text-right", p.pnl >= 0 ? "text-up" : "text-down")}>{signed(p.pnl)}</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line py-8 pb-20">
        <Suggestions initial={sug} bankroll={pf.cash} />
      </section>
    </div>
  );
}
