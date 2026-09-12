"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CompanyCard } from "@contracts/types";
import { Label } from "@/components/ui/label";
import { px, pct, usd } from "@/lib/format";
import "./landing.css";

/** Deterministic series off the id, so server and client render the same path. */
function series(id: string, n = 28) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100_003;
  const out: number[] = [];
  let v = 0.5;
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) % 2147483648;
    v = Math.min(1, Math.max(0, v + ((h % 1000) / 1000 - 0.48) * 0.24));
    out.push(v);
  }
  return out;
}

function Spark({ id, up }: { id: string; up: boolean }) {
  const pts = useMemo(() => series(id), [id]);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i / (pts.length - 1)) * 96} ${22 - p * 18}`)
    .join(" ");
  return (
    <svg viewBox="0 0 96 24" className="h-6 w-24 overflow-visible" aria-hidden>
      <path
        d={d}
        fill="none"
        strokeWidth="1"
        stroke={up ? "#2BC392" : "#EE5557"}
        className="bl-draw"
        style={{ strokeDasharray: 260, strokeDashoffset: 260 }}
      />
    </svg>
  );
}

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / 900);
      setN(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
      else setN(value);
    };
    setN(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{usd(n, { compact: true })}</>;
}

type Live = { bid: number; ask: number; last: number; dir: "up" | "down" | null; v: number };

/**
 * The trending ledger. Prices move on the same ten second cadence as a real
 * market, a row shows its recent path on hover, and the last print keeps the
 * colour of the direction it moved.
 */
export function LandingTrending({ companies }: { companies: CompanyCard[] }) {
  const [live, setLive] = useState<Record<string, Live>>(() =>
    Object.fromEntries(
      companies.map((c) => [c._id, { bid: c.bid ?? 0, ask: c.ask ?? 0, last: c.last ?? 0, dir: null, v: 0 }]),
    ),
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setLive((prev) => {
        const keys = Object.keys(prev);
        if (!keys.length) return prev;
        const k = keys[Math.floor(Math.random() * keys.length)];
        const cur = prev[k];
        const step = Math.round((Math.random() - 0.46) * 90) / 100;
        const last = Math.max(1, Math.round((cur.last + step) * 100) / 100);
        return {
          ...prev,
          [k]: {
            bid: Math.round((cur.bid + step * 0.8) * 100) / 100,
            ask: Math.round((cur.ask + step * 0.8) * 100) / 100,
            last,
            dir: step >= 0 ? "up" : "down",
            v: cur.v + 1,
          },
        };
      });
    }, 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="hidden md:grid grid-cols-[1fr_104px_120px_96px_96px_96px_80px] gap-4 px-3 pb-2">
        <Label>Company</Label>
        <Label className="text-right">Trend</Label>
        <Label className="text-right">Value</Label>
        <Label className="text-right">Bid</Label>
        <Label className="text-right">Ask</Label>
        <Label className="text-right">Last</Label>
        <Label className="text-right">Conf</Label>
      </div>

      <ul className="flex flex-col gap-px">
        {companies.map((c, i) => {
          const l = live[c._id] ?? { bid: c.bid ?? 0, ask: c.ask ?? 0, last: c.last ?? 0, dir: null, v: 0 };
          return (
            <li key={c._id} className="bl-rise" style={{ animationDelay: `${i * 70}ms` }}>
              <Link
                href={`/company/${c._id}`}
                className="group relative grid grid-cols-[1fr_auto] md:grid-cols-[1fr_104px_120px_96px_96px_96px_80px] items-center gap-x-4 gap-y-1 bg-surface px-3 py-3 transition-colors duration-150 ease-out hover:bg-surface-hover"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-px origin-top scale-y-0 bg-accent transition-transform duration-150 ease-out group-hover:scale-y-100"
                />
                <div className="min-w-0">
                  <div className="truncate text-[16px]">{c.name}</div>
                  <div className="text-[13px] secondary">
                    {c.city}, {c.state} · {c.category.replace(/_/g, " ")}
                  </div>
                </div>

                <div className="hidden md:flex justify-end opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
                  <Spark id={c._id} up={l.dir !== "down"} />
                </div>

                <div className="font-mono text-[13px] tabular-nums text-right">
                  <CountUp value={(c.v0_per_share ?? 0) * 10_000} />
                </div>
                <div className="hidden md:block font-mono text-[13px] tabular-nums text-right text-up">{px(l.bid)}</div>
                <div className="hidden md:block font-mono text-[13px] tabular-nums text-right text-down">{px(l.ask)}</div>
                <div
                  key={`${c._id}-${l.v}`}
                  className={`hidden md:block font-mono text-[13px] tabular-nums text-right ${l.dir === "up" ? "bl-tick-up" : l.dir === "down" ? "bl-tick-down" : ""}`}
                >
                  {px(l.last)}
                </div>
                <div className="hidden md:block font-mono text-[13px] tabular-nums text-right text-muted-foreground">
                  {pct(c.confidence)}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
