"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Plate } from "@/components/ui/plate";
import "./landing.css";

const W = 560;
const H = 360;
const PAD = 28;

type Order = { side: "bid" | "ask"; price: number; qty: number; x: number; y: number };

/** One deterministic book, so the figure is the same on every load. */
function book(): Order[] {
  const out: Order[] = [];
  let h = 20260912;
  const rnd = () => {
    h = (h * 1103515245 + 12345) % 2147483648;
    return (h % 10_000) / 10_000;
  };
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? "bid" : "ask";
    const price = side === "bid" ? 48 + rnd() * 10 : 53 + rnd() * 11;
    out.push({ side, price, qty: 20 + Math.round(rnd() * 160), x: PAD + rnd() * (W - PAD * 2), y: PAD + rnd() * (H - PAD * 2) });
  }
  return out;
}

const LO = 46;
const HI = 66;
const yAt = (p: number) => H - PAD - ((p - LO) / (HI - LO)) * (H - PAD * 2);

/**
 * Uniform price clearing, the same rule the exchange runs: the price that
 * matches the most quantity wins, and every fill happens at it.
 */
function clearAt(orders: Order[]) {
  const bids = orders.filter((o) => o.side === "bid");
  const asks = orders.filter((o) => o.side === "ask");
  let best = { price: 0, matched: 0 };
  for (const c of orders) {
    const demand = bids.reduce((a, o) => a + (o.price >= c.price ? o.qty : 0), 0);
    const supply = asks.reduce((a, o) => a + (o.price <= c.price ? o.qty : 0), 0);
    const matched = Math.min(demand, supply);
    if (matched > best.matched) best = { price: c.price, matched };
  }
  return best;
}

/**
 * A book becoming a price. Scroll advances it: orders arrive, the two sides
 * sort into depth, one line clears the lot. Nothing here is decoration, the
 * geometry is a real uniform price batch auction.
 */
export function LandingClearing() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      setP(travel <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / travel)));
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

  const orders = useMemo(book, []);
  const cleared = useMemo(() => clearAt(orders), [orders]);
  const step = p < 0.34 ? 0 : p < 0.68 ? 1 : 2;

  // 0 at "scattered", 1 at "sorted into the ladder"
  const sort = Math.min(1, Math.max(0, (p - 0.14) / 0.34));
  const clear = Math.min(1, Math.max(0, (p - 0.62) / 0.24));

  const bids = useMemo(() => orders.filter((o) => o.side === "bid").sort((a, b) => b.price - a.price), [orders]);
  const asks = useMemo(() => orders.filter((o) => o.side === "ask").sort((a, b) => a.price - b.price), [orders]);
  const bestBid = bids[0]?.price ?? 58;
  const bestAsk = asks[0]?.price ?? 53;

  const steps = [
    { id: "01", label: "Orders", stat: `${orders.length} resting` },
    { id: "02", label: "Cross", stat: `${bestBid.toFixed(2)} / ${bestAsk.toFixed(2)}` },
    { id: "03", label: "Cleared", stat: `${cleared.price.toFixed(2)} \u00d7 ${cleared.matched}` },
  ];

  const stair = (list: Order[], dir: -1 | 1) => {
    let cum = 0;
    const pts: string[] = [];
    for (const o of list) {
      const x = W / 2 + dir * (cum / 900) * (W / 2 - PAD);
      pts.push(`${x},${yAt(o.price)}`);
      cum += o.qty;
      pts.push(`${W / 2 + dir * (cum / 900) * (W / 2 - PAD)},${yAt(o.price)}`);
    }
    return `M${pts.join(" L")}`;
  };

  return (
    <div ref={hostRef} className="relative h-[190vh]">
      <div className="sticky top-0 flex min-h-screen items-center">
        <div className="mx-auto w-full max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[300px_1fr]">
            <div>
              <Label className="mb-2 block">Clearing</Label>
              <h2 className="text-[30px] md:text-[32px] leading-[1.2]">One price, every ten seconds.</h2>

              <ol className="mt-8 flex flex-col">
                {steps.map((s, i) => {
                  const on = i <= step;
                  const now = i === step;
                  return (
                    <li key={s.id} className="relative flex items-baseline gap-4 border-t border-line py-3.5">
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 h-px bg-accent transition-transform duration-300 ease-out"
                        style={{ width: "100%", transformOrigin: "left", transform: `scaleX(${now ? Math.min(1, (p - i * 0.34) / 0.34) : on ? 1 : 0})` }}
                      />
                      <span className={`font-mono text-[10px] tabular-nums ${on ? "text-accent" : "text-tint-400"}`}>{s.id}</span>
                      <span className={`flex-1 text-[16px] transition-colors duration-300 ${on ? "text-foreground" : "text-tint-400"}`}>
                        {s.label}
                      </span>
                      <span
                        className={`font-mono text-[11px] tabular-nums transition-opacity duration-300 ${on ? "opacity-100 secondary" : "opacity-0"}`}
                      >
                        {s.stat}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <Plate id="One batch" caption={steps[step].label.toUpperCase()}>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Order book clearing">
                {/* price grid */}
                {[50, 55, 60, 65].map((v) => (
                  <g key={v}>
                    <line x1={PAD} x2={W - PAD} y1={yAt(v)} y2={yAt(v)} stroke="#D4D4DD" strokeWidth="0.5" />
                    <text x={PAD - 6} y={yAt(v) + 3} textAnchor="end" fontSize="8" fill="#A1A0B8" fontFamily="var(--font-mono)">
                      {v}
                    </text>
                  </g>
                ))}

                {/* the orders themselves, sliding from scattered into their price row */}
                {orders.map((o, i) => {
                  const ty = o.y + (yAt(o.price) - o.y) * sort;
                  const tx = o.x + ((o.side === "bid" ? W / 2 - 60 - (i % 7) * 16 : W / 2 + 60 + (i % 7) * 16) - o.x) * sort;
                  return (
                    <circle
                      key={i}
                      cx={tx}
                      cy={ty}
                      r={2.4}
                      fill={o.side === "bid" ? "#2BC392" : "#EE5557"}
                      opacity={0.28 + 0.5 * (1 - sort)}
                      style={{ transition: "opacity 300ms cubic-bezier(0,0,0.2,1)" }}
                    />
                  );
                })}

                {/* the crossed band: every price at which a bid meets an ask */}
                <rect
                  x={PAD}
                  width={W - PAD * 2}
                  y={yAt(bestBid)}
                  height={Math.max(0, yAt(bestAsk) - yAt(bestBid))}
                  fill="#755CFE"
                  opacity={0.07 * sort}
                />

                {/* cumulative depth, drawn once the orders have sorted */}
                <g opacity={sort} style={{ transition: "opacity 300ms cubic-bezier(0,0,0.2,1)" }}>
                  <path d={stair(bids, -1)} fill="none" stroke="#2BC392" strokeWidth="1.6" />
                  <path d={stair(asks, 1)} fill="none" stroke="#EE5557" strokeWidth="1.6" />
                  <text x={PAD} y={yAt(bestBid) - 5} fontSize="9" fill="#2BC392" fontFamily="var(--font-mono)">
                    {bestBid.toFixed(2)}
                  </text>
                  <text x={PAD} y={yAt(bestAsk) + 12} fontSize="9" fill="#EE5557" fontFamily="var(--font-mono)">
                    {bestAsk.toFixed(2)}
                  </text>
                </g>

                {/* the clearing price */}
                <g opacity={clear} style={{ transition: "opacity 300ms cubic-bezier(0,0,0.2,1)" }}>
                  <rect x={PAD} y={yAt(cleared.price) - 9} width={(W - PAD * 2) * clear} height={18} fill="#755CFE" opacity="0.12" />
                  <line
                    x1={PAD}
                    x2={PAD + (W - PAD * 2) * clear}
                    y1={yAt(cleared.price)}
                    y2={yAt(cleared.price)}
                    stroke="#755CFE"
                    strokeWidth="1.5"
                  />
                  <text
                    x={W - PAD}
                    y={yAt(cleared.price) - 7}
                    textAnchor="end"
                    fontSize="10"
                    fill="#755CFE"
                    fontFamily="var(--font-mono)"
                  >
                    {cleared.price.toFixed(2)}
                  </text>
                </g>
              </svg>
            </Plate>
          </div>
        </div>
      </div>
    </div>
  );
}
