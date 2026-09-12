"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plate } from "@/components/ui/plate";
import { px } from "@/lib/format";
import "./landing.css";

const CYCLE_MS = 10_000;
const LEVELS = 7;

type Level = { price: number; bid: number; ask: number };

function ladder(mid: number, seed: number): Level[] {
  const out: Level[] = [];
  for (let i = 0; i < LEVELS; i++) {
    const offset = (Math.floor(LEVELS / 2) - i) * 0.9;
    const price = mid + offset;
    // deterministic pseudo-noise so the first paint matches the server
    const n = Math.abs(Math.sin((i + 1) * 12.9898 + seed * 78.233)) % 1;
    out.push({
      price,
      bid: offset < 0 ? Math.round(20 + n * 180) : 0,
      ask: offset > 0 ? Math.round(20 + ((n * 137) % 1) * 170) : 0,
    });
  }
  return out;
}

/**
 * The hero's right column. A live book on one market, clearing on the real
 * ten second cadence, so the first thing on the page is a price moving.
 */
export function LandingTape({ name = "Squirrel Hill Wash and Fold", start = 56.4 }: { name?: string; start?: number }) {
  const [mid, setMid] = useState(start);
  const [last, setLast] = useState(start);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const [seed, setSeed] = useState(1);
  const [left, setLeft] = useState(CYCLE_MS);
  const [flash, setFlash] = useState(0);
  const startedRef = useRef<number | null>(null);

  useEffect(() => {
    startedRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      const t = performance.now() - (startedRef.current ?? 0);
      const rem = CYCLE_MS - (t % CYCLE_MS);
      setLeft(rem);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSeed((s) => s + 1);
      setMid((m) => {
        const step = (Math.random() - 0.48) * 1.6;
        const next = Math.max(20, Math.round((m + step) * 100) / 100);
        setDir(next >= m ? "up" : "down");
        setLast(next);
        return next;
      });
      setFlash((f) => f + 1);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => ladder(mid, seed), [mid, seed]);
  const peak = useMemo(() => Math.max(...rows.map((r) => Math.max(r.bid, r.ask)), 1), [rows]);
  const midIndex = Math.floor(LEVELS / 2);
  const secs = Math.ceil(left / 1000);

  return (
    <Plate id="How a round works (illustration)" caption={`${String(secs).padStart(2, "0")}s`} className="w-full">
      <div className="flex items-baseline justify-between gap-3 border-b border-hairline px-3 py-2.5">
        <span className="truncate text-[13px]">{name}</span>
        <span
          key={`last-${flash}`}
          className={`font-mono text-[15px] tabular-nums ${dir === "down" ? "text-down bl-tick-down" : dir === "up" ? "text-up bl-tick-up" : ""}`}
        >
          {px(last)}
        </span>
      </div>

      <div key={`book-${flash}`} className="flex flex-col gap-px px-3 py-3">
        {rows.map((r, i) => {
          const isMid = i === midIndex;
          return (
            <div
              key={r.price.toFixed(2)}
              className={`grid grid-cols-[1fr_58px_1fr] items-center gap-2 ${isMid ? "bl-clear-flash" : ""}`}
            >
              <div className="flex justify-end">
                {isMid ? (
                  <div className="h-px w-full bg-accent/45" />
                ) : (
                  <div
                    className="bl-depth h-[9px] bg-up/70"
                    style={{ width: `${(r.bid / peak) * 100}%`, ["--bl-origin" as string]: "right" }}
                  />
                )}
              </div>
              <div
                className={`text-center font-mono text-[11px] tabular-nums ${isMid ? "text-accent" : "text-tint-500"}`}
              >
                {px(r.price)}
              </div>
              <div className="flex justify-start">
                {isMid ? (
                  <div className="h-px w-full bg-accent/45" />
                ) : (
                  <div
                    className="bl-depth h-[9px] bg-down/70"
                    style={{ width: `${(r.ask / peak) * 100}%`, ["--bl-origin" as string]: "left" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hairline px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-tint-400">Bids</span>
        <div className="relative h-px flex-1 bg-line">
          <span
            className="bl-progress absolute inset-y-0 left-0 w-full bg-accent"
            style={{ transform: `scaleX(${1 - left / CYCLE_MS})` }}
          />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-tint-400">Asks</span>
      </div>
    </Plate>
  );
}
