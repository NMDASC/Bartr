"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Valuation } from "@contracts/types";
import { Plate } from "@/components/ui/plate";
import { usd } from "@/lib/format";
import "./landing.css";

const W = 900;
const H = 300;
const PL = 8;
const PR = 8;
const PT = 18;
const PB = 46;

/**
 * The API names estimators with its own enum. Those are internal identifiers,
 * not labels a reader can use, so the UI names the method. Same mapping the
 * company page uses.
 */
const LABEL: Record<string, string> = {
  income: "Income",
  listing: "Asking price",
  proxy: "Inferred",
  llm: "AI estimate",
  base_rate: "Category median",
};

/** Standard normal CDF, Abramowitz and Stegun 26.2.17. Good to 7 decimals. */
function phi(z: number) {
  const s = z < 0 ? -1 : 1;
  const a = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return 0.5 * (1 + s * y);
}

/**
 * The bridge between a business nobody priced and a market that clears. One
 * posterior over what a laundromat is worth, the estimators that built it, and
 * a readout that answers the only question a buyer actually has: what are the
 * odds it is worth at least this much.
 */
export function LandingValuation({ valuation, name }: { valuation: Valuation; name: string }) {
  const { v0, sigma, estimates } = valuation;
  const svgRef = useRef<SVGSVGElement>(null);
  const [mark, setMark] = useState(v0);
  const [touched, setTouched] = useState(false);

  const lo = v0 * Math.exp(-2.7 * sigma);
  const hi = v0 * Math.exp(2.7 * sigma);
  const x = useCallback((v: number) => PL + ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (W - PL - PR), [lo, hi]);
  const vAt = useCallback(
    (px: number) => Math.exp(Math.log(lo) + ((px - PL) / (W - PL - PR)) * (Math.log(hi) - Math.log(lo))),
    [lo, hi],
  );

  // lognormal density, sampled in log space so the curve is smooth on this axis
  const curve = useMemo(() => {
    const pts: { v: number; d: number }[] = [];
    for (let i = 0; i <= 180; i++) {
      const t = i / 180;
      const v = Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo)));
      const z = (Math.log(v) - Math.log(v0)) / sigma;
      pts.push({ v, d: Math.exp(-0.5 * z * z) });
    }
    return pts;
  }, [lo, hi, v0, sigma]);

  const yTop = PT + 10;
  const yBase = H - PB;
  const dPath = curve.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.v).toFixed(1)},${(yBase - p.d * (yBase - yTop)).toFixed(1)}`).join(" ");
  const fillPath = `${dPath} L${x(hi)},${yBase} L${x(lo)},${yBase} Z`;

  // area at or above the mark
  const shade = useMemo(() => {
    const above = curve.filter((p) => p.v >= mark);
    if (above.length < 2) return "";
    const head = `M${x(mark).toFixed(1)},${yBase}`;
    const top = above.map((p) => `L${x(p.v).toFixed(1)},${(yBase - p.d * (yBase - yTop)).toFixed(1)}`).join(" ");
    return `${head} L${x(mark).toFixed(1)},${(yBase - Math.exp(-0.5 * Math.pow((Math.log(mark) - Math.log(v0)) / sigma, 2)) * (yBase - yTop)).toFixed(1)} ${top} L${x(hi).toFixed(1)},${yBase} Z`;
  }, [curve, mark, x, v0, sigma, yBase, yTop]);

  const pAbove = 1 - phi((Math.log(mark) - Math.log(v0)) / sigma);

  const move = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      setMark(Math.min(hi, Math.max(lo, vAt(Math.min(W - PR, Math.max(PL, px))))));
      setTouched(true);
    },
    [hi, lo, vAt],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onMove = (e: PointerEvent) => move(e.clientX);
    svg.addEventListener("pointermove", onMove);
    return () => svg.removeEventListener("pointermove", onMove);
  }, [move]);

  return (
    <Plate id="Posterior" caption={name}>
      <div className="border-b border-hairline px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-tint-400">
            Worth at least <span className="text-accent tabular-nums">{usd(mark, { compact: true })}</span>
          </span>
          <span className="font-mono text-[26px] leading-none tabular-nums text-accent">{Math.round(pAbove * 100)}%</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-tint-400 tabular-nums">
            {usd(valuation.low, { compact: true })} &ndash; {usd(valuation.high, { compact: true })} at 80%
          </span>
        </div>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-ew-resize touch-none" role="img" aria-label={`Value posterior for ${name}`}>
        <path d={fillPath} fill="#755CFE" opacity="0.06" />
        {shade ? <path d={shade} fill="#755CFE" opacity="0.16" /> : null}
        <path d={dPath} fill="none" stroke="#755CFE" strokeWidth="1.25" />
        <line x1={PL} x2={W - PR} y1={yBase} y2={yBase} stroke="#D4D4DD" strokeWidth="0.5" />

        {/* the three estimators, each with its own 80% span, on the same scale */}
        {estimates.map((e, i) => {
          const cy = yBase + 14 + i * 11;
          const a = e.value * Math.exp(-0.8416 * e.sigma);
          const b = e.value * Math.exp(0.8416 * e.sigma);
          return (
            <g key={e.name}>
              <line x1={Math.max(PL, x(a))} x2={Math.min(W - PR, x(b))} y1={cy} y2={cy} stroke="#1D1956" strokeWidth="1" opacity="0.22" />
              <circle cx={x(e.value)} cy={cy} r="2.6" fill="#1D1956" opacity="0.6" />
              <text x={Math.min(W - PR, x(b)) + 8} y={cy + 3} fontSize="9" fill="#706E8B" fontFamily="var(--font-mono)">
                {LABEL[e.name] ?? e.name}
              </text>
            </g>
          );
        })}

        {/* the mark */}
        <line x1={x(mark)} x2={x(mark)} y1={PT} y2={yBase} stroke="#755CFE" strokeWidth="1.25" />
        <circle cx={x(mark)} cy={yBase} r="3.4" fill="#755CFE" />
        {!touched ? (
          <text x={x(mark) + 8} y={PT + 10} fontSize="10" fill="#755CFE" fontFamily="var(--font-mono)">
            {usd(v0, { compact: true })}
          </text>
        ) : null}
      </svg>
    </Plate>
  );
}
