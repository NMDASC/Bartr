import type { Company } from "@contracts/types";
import { usd, pct } from "@/lib/format";
import { Label } from "@/components/ui/label";

/** Model value vs market-implied value on one ruled scale. */
/**
 * The API names estimators with its own enum (income, listing, proxy, llm, base_rate).
 * Those are internal identifiers, not labels a reader can use, so the UI names the method instead.
 */
const ESTIMATOR_LABEL: Record<string, string> = {
  income: "Income",
  listing: "Asking price",
  proxy: "Inferred",
  llm: "AI estimate",
  base_rate: "Category median",
};

export function Valuation({ company, last }: { company: Company; last: number | null }) {
  const v = company.valuation;
  const f = company.financials;
  if (!v) {
    return (
      <div className="bg-card border border-line p-3">
        <Label className="mb-2 block">Valuation</Label>
        <p className="text-[14px] secondary">Not priced yet.</p>
      </div>
    );
  }
  // shared log scale across every method's +/-1 sigma range, so the bars are comparable
  const spans = v.estimates.flatMap((e) => [e.value * Math.exp(-e.sigma), e.value * Math.exp(e.sigma)]).concat([v.v0]);
  const sLo = Math.log(Math.min(...spans)) - 0.05;
  const sHi = Math.log(Math.max(...spans)) + 0.05;
  const scale = (x: number) => ((Math.log(x) - sLo) / (sHi - sLo)) * 100;
  const shares = company.market?.shares_outstanding ?? 10000;
  const market = last !== null ? last * shares : null;
  // log scale between low and high, padded
  const lo = Math.log(v.low) - 0.08;
  const hi = Math.log(v.high) + 0.08;
  const pos = (x: number) => `${((Math.log(x) - lo) / (hi - lo)) * 100}%`;

  return (
    <div className="bg-card border border-line">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <Label>Valuation</Label>

      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label tracking="tight" className="block mb-1">Model</Label>
            <div className="text-[24px] leading-none tabular-nums">{usd(v.v0, { compact: true })}</div>
          </div>
          <div>
            <Label tracking="tight" className="block mb-1">Market implied</Label>
            <div className="text-[24px] leading-none tabular-nums text-accent">{market !== null ? usd(market, { compact: true }) : "\u2014"}</div>
          </div>
        </div>

        <div className="relative h-8" role="img" aria-label={`Valuation range ${usd(v.low, { compact: true })} to ${usd(v.high, { compact: true })}`}>
          <div className="absolute top-3 left-0 right-0 h-px bg-tint-300" />
          <div className="absolute top-3 h-px bg-primary" style={{ left: pos(v.low), right: `calc(100% - ${pos(v.high)})` }} />
          <div className="absolute top-1.5 w-px h-4 bg-primary" style={{ left: pos(v.v0) }} />
          {market !== null ? <div className="absolute top-0.5 w-px h-6 bg-accent" style={{ left: pos(market) }} /> : null}
          <span className="absolute top-5 font-mono text-[10px] tabular-nums text-muted-foreground" style={{ left: pos(v.low), transform: "translateX(-50%)" }}>
            {usd(v.low, { compact: true })}
          </span>
          <span className="absolute top-5 font-mono text-[10px] tabular-nums text-muted-foreground" style={{ left: pos(v.high), transform: "translateX(-50%)" }}>
            {usd(v.high, { compact: true })}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums border-t border-hairline pt-3">
          <dt className="uppercase tracking-[0.08em] text-muted-foreground">Revenue</dt>
          <dd className="text-right">{usd(f?.revenue_est ?? null, { cents: false })}</dd>
          <dt className="uppercase tracking-[0.08em] text-muted-foreground">SDE</dt>
          <dd className="text-right">{usd(f?.sde_est ?? null, { cents: false })}</dd>
          <dt className="uppercase tracking-[0.08em] text-muted-foreground">Margin</dt>
          <dd className="text-right">{pct(f?.margin_est ?? null, 1)}</dd>
          <dt className="uppercase tracking-[0.08em] text-muted-foreground">Confidence</dt>
          <dd className="text-right">{pct(f?.confidence ?? null)} {f?.method === "proxy" ? <span className="text-tint-400">proxy</span> : null}</dd>
        </dl>
        <div className="mt-3 border-t border-hairline pt-3">
          <div className="flex items-center justify-between mb-2">
            <Label tracking="tight">Methods</Label>
          </div>
          <ol className="flex flex-col gap-1.5">
            {v.estimates.map((e) => {
              const lo = e.value * Math.exp(-e.sigma);
              const hi = e.value * Math.exp(e.sigma);
              return (
                <li key={e.name} className="grid grid-cols-[86px_1fr_46px] items-center gap-x-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-tint-500 leading-[1.2]">
                    {ESTIMATOR_LABEL[e.name] ?? e.name.replace(/_/g, " ")}
                  </span>
                  <span className="relative block h-4" title={e.note}>
                    <span className="absolute left-0 right-0 top-1/2 h-px bg-hairline" />
                    <span className="absolute top-1/2 h-px -translate-y-1/2 bg-tint-400" style={{ left: `${scale(lo)}%`, width: `${scale(hi) - scale(lo)}%` }} />
                    <span className="absolute top-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 bg-primary" style={{ left: `${scale(e.value)}%` }} />
                    <span className="absolute inset-y-0 w-px bg-accent/45" style={{ left: `${scale(v.v0)}%` }} />
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-right">{usd(e.value, { compact: true })}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
