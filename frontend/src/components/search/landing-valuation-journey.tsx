"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Company, Estimate } from "@contracts/types";
import { Label } from "@/components/ui/label";
import { Plate } from "@/components/ui/plate";
import { pct, px, usd } from "@/lib/format";
import "./landing.css";

const W = 720;
const H = 360;
const PL = 44;
const PR = 18;
const PT = 22;
const PB = 42;

const LABEL: Record<string, string> = {
  income: "Income",
  listing: "Asking price",
  proxy: "Inferred",
  llm: "AI estimate",
  base_rate: "Category median",
};

type Order = { side: "bid" | "ask"; price: number; qty: number };

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function gate(p: number, a: number, b: number, reduced: boolean) {
  if (b <= a) return p >= a ? 1 : 0;
  if (reduced) return p >= a ? 1 : 0;
  return clamp01((p - a) / (b - a));
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function book(ref: number): Order[] {
  const out: Order[] = [];
  let h = 20260912;
  const rnd = () => {
    h = (h * 1103515245 + 12345) % 2147483648;
    return (h % 10_000) / 10_000;
  };
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? "bid" : "ask";
    out.push({
      side,
      price: side === "bid" ? ref * (0.86 + rnd() * 0.16) : ref * (0.96 + rnd() * 0.2),
      qty: 20 + Math.round(rnd() * 160),
    });
  }
  return out;
}

function clearAt(orders: Order[]) {
  const bids = orders.filter((o) => o.side === "bid");
  const asks = orders.filter((o) => o.side === "ask");
  const scored = orders.map((c) => {
    const demand = bids.reduce((a, o) => a + (o.price >= c.price ? o.qty : 0), 0);
    const supply = asks.reduce((a, o) => a + (o.price <= c.price ? o.qty : 0), 0);
    return { price: c.price, matched: Math.min(demand, supply) };
  });
  const matched = Math.max(...scored.map((s) => s.matched));
  const band = scored.filter((s) => s.matched === matched).map((s) => s.price);
  return { price: (Math.min(...band) + Math.max(...band)) / 2, matched };
}

function depth(list: Order[]) {
  let cum = 0;
  return list.map((o) => {
    cum += o.qty;
    return { o, to: cum };
  });
}

function polylineLength(points: { x: number; y: number }[]) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/**
 * One sticky pass: a found business, the estimators, the ensemble math, the
 * posterior, the listed value, then the book that clears from it.
 */
export function LandingValuationJourney({ company }: { company: Company }) {
  const valuation = company.valuation;
  const hostRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      setP(travel <= 0 ? 0 : clamp01(-r.top / travel));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const estimates = useMemo(() => valuation?.estimates ?? [], [valuation]);
  const shares = company.market?.shares_outstanding ?? 10_000;
  const v0 = valuation?.v0 ?? 0;
  const sigma = valuation?.sigma ?? 0.3;
  const low = valuation?.low ?? v0;
  const high = valuation?.high ?? v0;
  const ref = company.market?.ref_price ?? (v0 > 0 ? v0 / shares : 55.8);
  const mu = v0 > 0 ? Math.log(v0) : 0;

  const rows = useMemo(
    () =>
      estimates.map((e) => {
        const w = 1 / (e.sigma * e.sigma);
        return { ...e, mu: Math.log(e.value), w, label: LABEL[e.name] ?? e.name.replace(/_/g, " ") };
      }),
    [estimates],
  );

  const lo = v0 > 0 ? v0 * Math.exp(-2.7 * sigma) : 1;
  const hi = v0 > 0 ? v0 * Math.exp(2.7 * sigma) : 2;
  const xVal = (v: number) => PL + ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (W - PL - PR);
  const yBase = H - PB;
  const yTop = PT + 8;

  const density = useMemo(() => {
    if (v0 <= 0) return [];
    const xOf = (v: number) => PL + ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (W - PL - PR);
    const pts: { v: number; d: number; x: number; y: number }[] = [];
    for (let i = 0; i <= 180; i++) {
      const t = i / 180;
      const v = Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo)));
      const z = (Math.log(v) - Math.log(v0)) / sigma;
      const d = Math.exp(-0.5 * z * z);
      pts.push({ v, d, x: xOf(v), y: yBase - d * (yBase - yTop) });
    }
    return pts;
  }, [lo, hi, v0, sigma, yBase, yTop]);

  const dPath = density.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
  const fillPath = density.length ? `${dPath} L${xVal(hi).toFixed(1)},${yBase} L${xVal(lo).toFixed(1)},${yBase} Z` : "";
  const curveLen = useMemo(() => polylineLength(density), [density]);

  const orders = useMemo(() => book(ref), [ref]);
  const cleared = useMemo(() => clearAt(orders), [orders]);
  const bids = useMemo(() => depth(orders.filter((o) => o.side === "bid").sort((a, b) => b.price - a.price)), [orders]);
  const asks = useMemo(() => depth(orders.filter((o) => o.side === "ask").sort((a, b) => a.price - b.price)), [orders]);
  const qMax = Math.max(bids.at(-1)?.to ?? 1, asks.at(-1)?.to ?? 1);
  const pLo = ref * 0.78;
  const pHi = ref * 1.24;
  const xQty = (q: number) => PL + (q / qMax) * (W - PL - PR);
  const yPx = (v: number) => H - PB - ((v - pLo) / (pHi - pLo)) * (H - PB - PT);

  const stairs = (list: ReturnType<typeof depth>, t: number) => {
    if (!list.length) return "";
    const flowX = (q: number) => PL + (xQty(q) - PL) * t;
    let d = `M${flowX(0)},${yPx(list[0].o.price)}`;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      d += ` L${flowX(c.to)},${yPx(c.o.price)}`;
      if (i + 1 < list.length) d += ` L${flowX(c.to)},${yPx(list[i + 1].o.price)}`;
    }
    return d;
  };

  const facts = gate(p, 0.0, 0.1, reduced);
  const estT = gate(p, 0.1, 0.24, reduced);
  const eqT = gate(p, 0.24, 0.4, reduced);
  const curveT = gate(p, 0.4, 0.56, reduced);
  const valueT = gate(p, 0.56, 0.7, reduced);
  const shareT = gate(p, 0.7, 0.8, reduced);
  const queue = gate(p, 0.78, 0.9, reduced);
  const cross = gate(p, 0.88, 0.98, reduced);
  const bookT = gate(p, 0.74, 0.86, reduced);

  const steps = [
    { id: "01", label: "Business", stat: company.city && company.state ? `${company.city}, ${company.state}` : company.category },
    { id: "02", label: "Estimates", stat: `${rows.length} methods` },
    { id: "03", label: "Combine", stat: `σ ${sigma.toFixed(2)}` },
    { id: "04", label: "Posterior", stat: `${usd(low, { compact: true })} to ${usd(high, { compact: true })}` },
    { id: "05", label: "Listed", stat: usd(v0, { compact: true }) },
    { id: "06", label: "Bidding", stat: `${px(cleared.price)} / share` },
  ];
  const headings = [
    "Then we put a number on one.",
    "Three independent prices.",
    "Precision weighted into one μ.",
    "The distribution lands.",
    "One value, with a range.",
    "Live price updates, every 10 seconds.",
  ];
  const captions = ["PROFILE", "ESTIMATORS", "ENSEMBLE", "POSTERIOR", "LISTED", "ONE BATCH"];
  const segment = 1 / steps.length;
  const step = Math.min(steps.length - 1, Math.floor(p / segment + 1e-6));
  const f = company.financials;

  if (!valuation) return null;

  return (
    <div ref={hostRef} className="relative h-[480vh]">
      <div className="sticky top-0 flex min-h-screen items-center">
        <div className="mx-auto w-full max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-10 md:py-16">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] lg:gap-12">
            <div>
              <Label className="mb-2 block">Valuation</Label>
              <h2 className="text-[30px] md:text-[36px] 3xl:text-[44px] leading-[1.2]">{headings[step]}</h2>
              <ol className="mt-8 flex flex-col">
                {steps.map((s, i) => {
                  const on = i <= step;
                  const now = i === step;
                  return (
                    <li key={s.id} className="relative flex items-baseline gap-4 border-t border-line py-3.5">
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 h-px w-full bg-accent"
                        style={{
                          transformOrigin: "left",
                          transform: `scaleX(${now ? clamp01((p - i * segment) / segment) : on ? 1 : 0})`,
                        }}
                      />
                      <span className={`font-mono text-[10px] tabular-nums ${on ? "text-accent" : "text-tint-400"}`}>{s.id}</span>
                      <span className={`flex-1 text-[16px] ${on ? "text-foreground" : "text-tint-400"}`}>{s.label}</span>
                      <span className={`font-mono text-[11px] tabular-nums ${on ? "opacity-100 secondary" : "opacity-0"}`}>
                        {s.stat}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <Plate id={company.name} caption={captions[step]}>
              <div className="relative min-h-[320px] md:min-h-[400px]">
                <div className="absolute inset-0 bl-journey-layer" style={{ opacity: facts * (1 - estT) }} aria-hidden={estT > 0.85}>
                  <BusinessPane company={company} reveal={facts} />
                </div>

                <div className="absolute inset-0 bl-journey-layer" style={{ opacity: clamp01(estT * (1 - bookT * 0.92)) }}>
                  <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={`Valuation of ${company.name}`}>
                    <line x1={PL} x2={W - PR} y1={yBase} y2={yBase} stroke="#D4D4DD" strokeWidth="0.5" />
                    {[{ k: "lo", v: low }, { k: "v0", v: v0 }, { k: "hi", v: high }].map((tick) => (
                      <text key={tick.k} x={xVal(tick.v)} y={H - 14} textAnchor="middle" fontSize="8" fill="#A1A0B8" fontFamily="var(--font-mono)">
                        {usd(tick.v, { compact: true })}
                      </text>
                    ))}

                    {fillPath ? (
                      <path d={fillPath} fill="#755CFE" opacity={0.1 * curveT} />
                    ) : null}
                    {dPath ? (
                      <path
                        d={dPath}
                        fill="none"
                        stroke="#755CFE"
                        strokeWidth="1.4"
                        strokeDasharray={curveLen}
                        strokeDashoffset={curveLen * (1 - curveT)}
                        opacity={curveT}
                      />
                    ) : null}

                    <g opacity={valueT}>
                      <line x1={xVal(low)} x2={xVal(high)} y1={yBase} y2={yBase} stroke="#755CFE" strokeWidth="2.2" opacity="0.35" />
                      <line x1={xVal(v0)} x2={xVal(v0)} y1={yTop} y2={yBase} stroke="#755CFE" strokeWidth="1.25" />
                      <circle cx={xVal(v0)} cy={yBase} r="4" fill="#755CFE" />
                      <text x={xVal(v0) + 8} y={yTop + 10} fontSize="12" fill="#755CFE" fontFamily="var(--font-mono)">
                        {usd(v0, { compact: true })}
                      </text>
                    </g>

                    {rows.map((e, i) => {
                      const appear = clamp01(estT * rows.length - i);
                      const lift = 1 - curveT;
                      const cy = yBase - 18 * lift - i * 16 * lift;
                      const a = e.value * Math.exp(-0.8416 * e.sigma);
                      const b = e.value * Math.exp(0.8416 * e.sigma);
                      return (
                        <g key={e.name} opacity={appear}>
                          <line
                            x1={Math.max(PL, xVal(a))}
                            x2={Math.min(W - PR, xVal(b))}
                            y1={cy}
                            y2={cy}
                            stroke="#1D1956"
                            strokeWidth="1"
                            opacity="0.28"
                          />
                          <circle cx={xVal(e.value)} cy={cy} r="3" fill="#1D1956" />
                          <text x={xVal(e.value) + 8} y={cy - 6} fontSize="9" fill="#6C6991" fontFamily="var(--font-mono)">
                            {e.label} {usd(e.value, { compact: true })}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="absolute inset-x-4 top-4 bl-journey-layer md:inset-x-6" style={{ opacity: eqT * (1 - valueT) }}>
                  <EquationPane rows={rows} mu={mu} sigma={sigma} v0={v0} reveal={eqT} />
                </div>

                <div
                  className="absolute inset-x-4 bottom-4 bl-journey-layer font-mono text-[12px] tabular-nums text-accent md:inset-x-6"
                  style={{ opacity: shareT * (1 - queue) }}
                >
                  {usd(v0, { compact: true })} / {shares.toLocaleString()} = {px(ref)}
                </div>

                <div className="absolute inset-0 bl-journey-layer" style={{ opacity: bookT }}>
                  <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Bids and asks crossing at the clearing price">
                    {[0, 0.5, 1].map((f) => {
                      const price = pLo + (pHi - pLo) * (1 - f);
                      return (
                        <g key={f}>
                          <line x1={PL} x2={W - PR} y1={yPx(price)} y2={yPx(price)} stroke="#E6E6EF" strokeWidth="0.5" />
                          <text x={PL - 7} y={yPx(price) + 3} textAnchor="end" fontSize="8" fill="#A1A0B8" fontFamily="var(--font-mono)">
                            {price.toFixed(0)}
                          </text>
                        </g>
                      );
                    })}
                    <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#D4D4DD" strokeWidth="0.5" />
                    {[0, 0.5, 1].map((f) => (
                      <text
                        key={f}
                        x={xQty(qMax * f)}
                        y={H - PB + 14}
                        textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
                        fontSize="8"
                        fill="#A1A0B8"
                        fontFamily="var(--font-mono)"
                      >
                        {Math.round(qMax * f)}
                      </text>
                    ))}

                    <rect
                      x={PL}
                      y={yPx(cleared.price)}
                      width={Math.max(0, xQty(cleared.matched) - PL) * cross}
                      height={Math.max(0, H - PB - yPx(cleared.price))}
                      fill="#755CFE"
                      opacity={0.1 * cross}
                    />

                    {[...bids, ...asks].map((c, i) => {
                      const restX = xQty(c.to);
                      return (
                        <circle
                          key={i}
                          cx={PL + (restX - PL) * queue}
                          cy={yPx(c.o.price)}
                          r={2.4}
                          fill={c.o.side === "bid" ? "#2BC392" : "#EE5557"}
                          opacity={0.75 - 0.45 * queue}
                        />
                      );
                    })}

                    <path d={stairs(bids, queue)} fill="none" stroke="#2BC392" strokeWidth="1.6" opacity={queue} />
                    <path d={stairs(asks, queue)} fill="none" stroke="#EE5557" strokeWidth="1.6" opacity={queue} />

                    <g opacity={cross}>
                      <line x1={PL} x2={xQty(cleared.matched)} y1={yPx(cleared.price)} y2={yPx(cleared.price)} stroke="#755CFE" strokeWidth="1.25" strokeDasharray="3 3" />
                      <line x1={xQty(cleared.matched)} x2={xQty(cleared.matched)} y1={yPx(cleared.price)} y2={H - PB} stroke="#755CFE" strokeWidth="1.25" strokeDasharray="3 3" />
                      <circle cx={xQty(cleared.matched)} cy={yPx(cleared.price)} r="3.6" fill="#755CFE" />
                      <text x={PL + 6} y={yPx(cleared.price) - 8} fontSize="11" fill="#755CFE" fontFamily="var(--font-mono)">
                        {px(cleared.price)}
                      </text>
                      <text x={xQty(cleared.matched) + 6} y={H - PB - 8} fontSize="10" fill="#755CFE" fontFamily="var(--font-mono)">
                        {cleared.matched}
                      </text>
                    </g>
                  </svg>
                </div>
              </div>

              {f ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-hairline px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:grid-cols-4">
                  <div>
                    <dt>Revenue</dt>
                    <dd className="mt-0.5 text-[13px] normal-case tracking-normal text-foreground tabular-nums">{usd(f.revenue_est, { cents: false })}</dd>
                  </div>
                  <div>
                    <dt>SDE</dt>
                    <dd className="mt-0.5 text-[13px] normal-case tracking-normal text-foreground tabular-nums">{usd(f.sde_est, { cents: false })}</dd>
                  </div>
                  <div>
                    <dt>Margin</dt>
                    <dd className="mt-0.5 text-[13px] normal-case tracking-normal text-foreground tabular-nums">{pct(f.margin_est, 1)}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd className="mt-0.5 text-[13px] normal-case tracking-normal text-foreground tabular-nums">{pct(f.confidence)}</dd>
                  </div>
                </dl>
              ) : null}
            </Plate>
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessPane({ company, reveal }: { company: Company; reveal: number }) {
  const items = [
    company.city && company.state ? `${company.city}, ${company.state}` : null,
    company.category,
    company.founded_year ? `Since ${company.founded_year}` : null,
    company.rating !== null ? `${company.rating.toFixed(1)} · ${company.review_count} reviews` : null,
    company.financials?.employees_est != null ? `${company.financials.employees_est} employees` : null,
    company.owners?.[0] ?? null,
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="flex h-full flex-col justify-between px-5 py-5 md:px-6 md:py-6">
      <div>
        <p className="text-[22px] leading-[1.15] md:text-[28px]">{company.name}</p>
        <ul className="mt-5 flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li
              key={item}
              className="font-mono text-[12px] text-muted-foreground"
              style={{ opacity: clamp01(reveal * items.length - i) }}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
      {company.description ? (
        <p className="max-w-xl text-[14px] leading-[1.45] secondary" style={{ opacity: clamp01(reveal * 1.4 - 0.3) }}>
          {company.description}
        </p>
      ) : null}
    </div>
  );
}

function EquationPane({
  rows,
  mu,
  sigma,
  v0,
  reveal,
}: {
  rows: Array<Estimate & { mu: number; w: number; label: string }>;
  mu: number;
  sigma: number;
  v0: number;
  reveal: number;
}) {
  return (
    <div className="pointer-events-none border border-line bg-background/92 px-3 py-3 backdrop-blur-[2px] md:px-4">
      <p className="font-mono text-[11px] leading-[1.7] tabular-nums text-foreground" style={{ opacity: clamp01(reveal * 3) }}>
        μ = Σ μᵢ / σᵢ²  ÷  Σ 1 / σᵢ²
      </p>
      <p className="font-mono text-[11px] leading-[1.7] tabular-nums text-foreground" style={{ opacity: clamp01(reveal * 3 - 0.7) }}>
        V = e<sup>μ</sup>
      </p>
      <ol className="mt-2 flex flex-col gap-0.5">
        {rows.map((e, i) => (
          <li
            key={e.name}
            className="grid grid-cols-[1fr_auto] gap-3 font-mono text-[10px] tabular-nums text-muted-foreground sm:grid-cols-[88px_1fr_auto]"
            style={{ opacity: clamp01(reveal * rows.length - i) }}
          >
            <span className="uppercase tracking-[0.08em]">{e.label}</span>
            <span className="hidden sm:block">
              μ {e.mu.toFixed(3)} · σ {e.sigma.toFixed(2)} · w {e.w.toFixed(1)}
            </span>
            <span>{usd(e.value, { compact: true })}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 font-mono text-[11px] tabular-nums text-accent" style={{ opacity: clamp01(reveal * 2 - 1) }}>
        μ {mu.toFixed(3)} · σ {sigma.toFixed(2)} · V {usd(v0, { compact: true })}
      </p>
    </div>
  );
}
