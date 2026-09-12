"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./landing.css";

const BIDS = [
  { who: "B12", side: "buy" as const, qty: 80, price: "61.10" },
  { who: "B4", side: "buy" as const, qty: 40, price: "58.40" },
  { who: "You", side: "buy" as const, qty: 50, price: "59.80" },
  { who: "B7", side: "sell" as const, qty: 25, price: "62.20" },
];

/**
 * A working book, not a color wash. Bids land one at a time, then the round
 * prints one price, the way the live page does.
 */
export function LandingHeroArt() {
  const [n, setN] = useState(0);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = window.setTimeout(() => { setN(BIDS.length); setCleared(true); }, 0);
      return () => window.clearTimeout(t);
    }
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      if (step <= BIDS.length) {
        setN(step);
        setCleared(false);
        return;
      }
      if (step === BIDS.length + 1) {
        setCleared(true);
        return;
      }
      step = 0;
      setN(0);
      setCleared(false);
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-y-0 right-0 hidden w-[46%] xl:block">
        <div className="absolute inset-y-10 left-6 right-8">
          <Link
            href="/company/co_squirrel_hill_wash/bid"
            className="pointer-events-auto block h-full border border-line bg-card"
          >
            <div className="flex items-end justify-between border-b border-line px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Squirrel Hill Wash and Fold</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{cleared ? "Everyone paid" : "Round 1"}</p>
                <p className={`mt-1 font-mono text-[40px] leading-none tabular-nums ${cleared ? "text-up" : "text-foreground"}`}>
                  {cleared ? "$58.67" : "$57.08"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">To clear</p>
                <p className="font-mono text-[40px] leading-none tabular-nums">{cleared ? "0" : String(Math.max(0, 10 - n * 2))}</p>
              </div>
            </div>
            <ul className="grid grid-cols-4 gap-2 px-5 py-4">
              {["OW", "B12", "You", "B4"].map((who, i) => (
                <li key={who} className="flex flex-col items-center gap-1">
                  <span
                    className={`grid size-10 place-items-center border font-mono text-[11px] ${
                      who === "You" ? "border-accent bg-accent/[0.08] text-accent" : "border-line text-foreground"
                    } ${n > i ? "opacity-100" : "opacity-30"}`}
                  >
                    {who}
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 divide-x divide-line border-t border-line">
              <div className="px-5 py-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Bids</p>
                {BIDS.filter((b) => b.side === "buy").map((b, i) => {
                  const on = BIDS.slice(0, n).includes(b);
                  return (
                    <div
                      key={b.who}
                      className={`flex h-8 items-center justify-between font-mono text-[13px] tabular-nums ${
                        on ? "opacity-100" : "opacity-20"
                      } ${b.who === "You" ? "text-accent" : "text-up"}`}
                      style={{ transitionDelay: `${i * 80}ms` }}
                    >
                      <span>{b.who === "You" ? "You" : b.who}</span>
                      <span>{b.qty} @ {b.price}</span>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Asks</p>
                <div className="flex h-8 items-center justify-between font-mono text-[13px] tabular-nums text-down">
                  <span>Owner</span>
                  <span>600 @ 58.67</span>
                </div>
                {BIDS.filter((b) => b.side === "sell").map((b) => {
                  const on = BIDS.slice(0, n).includes(b);
                  return (
                    <div
                      key={b.who}
                      className={`flex h-8 items-center justify-between font-mono text-[13px] tabular-nums text-down ${
                        on ? "opacity-100" : "opacity-20"
                      }`}
                    >
                      <span>{b.who}</span>
                      <span>{b.qty} @ {b.price}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {cleared ? (
              <p className="border-t border-line px-5 py-3 font-mono text-[12px] text-up">305 shares at $58.67. One price.</p>
            ) : null}
          </Link>
        </div>
      </div>
    </div>
  );
}
