"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Plate } from "@/components/ui/plate";
import "./landing.css";

const W = 600;
const H = 380;
const PL = 38; // left gutter, price labels
const PR = 16;
const PT = 18;
const PB = 30; // bottom gutter, quantity labels

type Order = { side: "bid" | "ask"; price: number; qty: number; jx: number; jy: number };

/** One deterministic book, so the figure is identical on every load. */
function book(): Order[] {
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
      price: side === "bid" ? 48 + rnd() * 10 : 53 + rnd() * 11,
      qty: 20 + Math.round(rnd() * 160),
      jx: rnd(),
      jy: rnd(),
    });
  }
  return out;
}

/**
 * Uniform price clearing: the price that matches the most quantity wins, and
 * every fill happens at it.
 *
 * Maximum volume is usually achieved over a RANGE of prices, not one, and this
 * book is a case in point: 55.13, 55.25, 55.38 and 55.57 all clear 337. Taking
 * the first candidate found would put the print at the bottom of that range
 * every time, which is a standing gift to the buy side. The tie breaks at the
 * midpoint instead.
 */
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

/** Cumulative curve: each order's place in the queue at its own limit price. */
function curve(list: Order[]) {
  let cum = 0;
  return list.map((o) => {
    const from = cum;
    cum += o.qty;
    return { o, from, to: cum };
  });
}

/**
 * A book becoming a price. Scroll advances it: every order arrives at its own
 * limit, takes its place in the queue behind everyone who bid better, and the
 * two curves cross at exactly one price. That crossing is the auction.
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

  const bids = useMemo(() => curve(orders.filter((o) => o.side === "bid").sort((a, b) => b.price - a.price)), [orders]);
  const asks = useMemo(() => curve(orders.filter((o) => o.side === "ask").sort((a, b) => a.price - b.price)), [orders]);

  const qMax = Math.max(bids.at(-1)?.to ?? 1, asks.at(-1)?.to ?? 1);
  const LO = 46;
  const HI = 66;
  const x = (q: number) => PL + (q / qMax) * (W - PL - PR);
  const y = (v: number) => H - PB - ((v - LO) / (HI - LO)) * (H - PB - PT);

  const step = p < 0.34 ? 0 : p < 0.68 ? 1 : 2;
  const queue = Math.min(1, Math.max(0, (p - 0.1) / 0.36)); // orders take their place
  const cross = Math.min(1, Math.max(0, (p - 0.64) / 0.22)); // the cross is marked

  const resting = orders.reduce((a, o) => a + o.qty, 0);
  const steps = [
    { id: "01", label: "Orders", stat: `${orders.length} resting` },
    // both sides, because qMax is only the larger of the two and reads as the book
    { id: "02", label: "Depth", stat: `${resting.toLocaleString()} shares` },
    { id: "03", label: "Cleared", stat: `${cleared.price.toFixed(2)} \u00d7 ${cleared.matched}` },
  ];

  /** Staircase through the cumulative points, drawn only as far as `t`. */
  const path = (list: ReturnType<typeof curve>, t: number) => {
    if (!list.length) return "";
    const n = Math.max(1, Math.ceil(list.length * t));
    let d = `M${x(0)},${y(list[0].o.price)}`;
    for (let i = 0; i < n; i++) {
      const c = list[i];
      d += ` L${x(c.to)},${y(c.o.price)}`;
      if (i + 1 < n) d += ` L${x(c.to)},${y(list[i + 1].o.price)}`;
    }
    return d;
  };

  const qx = x(cleared.matched);
  const py = y(cleared.price);

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
                        className="absolute left-0 top-0 h-px w-full bg-accent transition-transform duration-300 ease-out"
                        style={{
                          transformOrigin: "left",
                          transform: `scaleX(${now ? Math.min(1, Math.max(0, (p - i * 0.34) / 0.34)) : on ? 1 : 0})`,
                        }}
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
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative bids and asks crossing at the clearing price">
                {/* price axis */}
                {[50, 55, 60, 65].map((v) => (
                  <g key={v}>
                    <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#E6E6EF" strokeWidth="0.5" />
                    <text x={PL - 7} y={y(v) + 3} textAnchor="end" fontSize="8" fill="#A1A0B8" fontFamily="var(--font-mono)">
                      {v}
                    </text>
                  </g>
                ))}

                {/* quantity axis */}
                <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#D4D4DD" strokeWidth="0.5" />
                {[0, 0.5, 1].map((f) => (
                  <text
                    key={f}
                    x={x(qMax * f)}
                    y={H - PB + 13}
                    textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
                    fontSize="8"
                    fill="#A1A0B8"
                    fontFamily="var(--font-mono)"
                  >
                    {Math.round(qMax * f)}
                  </text>
                ))}

                {/* what actually trades: this much quantity, at this one price */}
                <rect
                  x={PL}
                  y={py}
                  width={Math.max(0, qx - PL) * cross}
                  height={Math.max(0, H - PB - py)}
                  fill="#755CFE"
                  opacity={0.09 * cross}
                />

                {/* every order sliding from its limit price into its place in the line */}
                {[...bids, ...asks].map((c, i) => {
                  const restX = x(c.to);
                  const restY = y(c.o.price);
                  // they all start on the price axis: a limit, with no size accounted for yet
                  const arriveX = PL + 3 + c.o.jx * 5;
                  const cx = arriveX + (restX - arriveX) * queue;
                  return (
                    <circle
                      key={i}
                      cx={cx}
                      cy={restY}
                      r={2.4}
                      fill={c.o.side === "bid" ? "#2BC392" : "#EE5557"}
                      opacity={0.75 - 0.45 * queue}
                    />
                  );
                })}

                {/* the two cumulative curves */}
                <path d={path(bids, queue)} fill="none" stroke="#2BC392" strokeWidth="1.6" opacity={queue} />
                <path d={path(asks, queue)} fill="none" stroke="#EE5557" strokeWidth="1.6" opacity={queue} />

                {/* the crossing: one price, one quantity */}
                <g opacity={cross}>
                  <line x1={PL} x2={qx} y1={py} y2={py} stroke="#755CFE" strokeWidth="1.25" strokeDasharray="3 3" />
                  <line x1={qx} x2={qx} y1={py} y2={H - PB} stroke="#755CFE" strokeWidth="1.25" strokeDasharray="3 3" />
                  <circle cx={qx} cy={py} r={3.6} fill="#755CFE" />
                  <text x={PL + 4} y={py - 7} fontSize="10" fill="#755CFE" fontFamily="var(--font-mono)">
                    {cleared.price.toFixed(2)}
                  </text>
                  <text x={qx + 6} y={H - PB - 6} fontSize="10" fill="#755CFE" fontFamily="var(--font-mono)">
                    {cleared.matched}
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
