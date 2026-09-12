"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plate } from "@/components/ui/plate";
import "./landing.css";

const CATEGORIES: { name: string; lo: number; hi: number }[] = [
  { name: "Laundromat", lo: 320_000, hi: 980_000 },
  { name: "Car wash", lo: 700_000, hi: 2_400_000 },
  { name: "Machine shop", lo: 1_100_000, hi: 4_200_000 },
  { name: "Dry cleaner", lo: 280_000, hi: 1_150_000 },
  { name: "Auto body", lo: 640_000, hi: 2_900_000 },
  { name: "Self storage", lo: 1_400_000, hi: 6_100_000 },
  { name: "Bakery", lo: 210_000, hi: 890_000 },
  { name: "HVAC", lo: 900_000, hi: 3_600_000 },
  { name: "Print shop", lo: 260_000, hi: 1_050_000 },
  { name: "Vending route", lo: 180_000, hi: 720_000 },
];

const TRACTS = ["Squirrel Hill", "Bloomfield", "Lawrenceville", "McKees Rocks", "Shadyside", "Homestead", "Carnegie", "Oakland", "Strip District", "South Side"];

const STEP = 26;
const RADIUS = 128;
const ACCENT = "117, 92, 254";
const PANEL_MS = 150;

function hash(i: number) {
  let h = (i + 1) * 2654435761;
  h ^= h >>> 13;
  h = (h * 1274126177) >>> 0;
  return h / 4294967296;
}

function compact(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}K`;
}

type Hit = { key: number; cat: string; tract: string; value: string; conf: number };

function describe(i: number): Hit {
  const cat = CATEGORIES[i % CATEGORIES.length];
  const v = cat.lo + hash(i + 31) * (cat.hi - cat.lo);
  return {
    key: i,
    cat: cat.name,
    tract: TRACTS[(i * 7) % TRACTS.length],
    value: compact(v),
    conf: Math.round(34 + hash(i + 97) * 56),
  };
}

/**
 * Coverage. Every mark is a business we can reach and none of them carry a
 * number until something asks. The lens is that ask: it prices whatever the
 * reader points at and lets it go the moment they move on.
 */
export function LandingCoverage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: -999, y: -999, live: false });
  const lastPanel = useRef(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [count, setCount] = useState({ priced: 0, total: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cols = Math.floor((w - 24) / STEP);
    const rows = Math.floor((h - 24) / STEP);
    const ox = (w - (cols - 1) * STEP) / 2;
    const oy = (h - (rows - 1) * STEP) / 2;
    const { x: px, y: py, live } = pointer.current;

    let priced = 0;
    const near: { i: number; d: number }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = ox + c * STEP + (hash(i) - 0.5) * 10;
        const y = oy + r * STEP + (hash(i + 7919) - 0.5) * 10;
        const d = live ? Math.hypot(x - px, y - py) : Infinity;

        if (d < RADIUS) {
          priced++;
          const t = 1 - d / RADIUS;
          const size = 3 + t * 4;
          ctx.fillStyle = `rgba(${ACCENT}, ${0.3 + t * 0.7})`;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
          near.push({ i, d });
        } else {
          ctx.fillStyle = `rgba(${ACCENT}, 0.2)`;
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
    }

    if (live) {
      ctx.strokeStyle = `rgba(${ACCENT}, 0.4)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(px, py, RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // crosshair, short ticks only
      ctx.beginPath();
      ctx.moveTo(px - 7, py);
      ctx.lineTo(px + 7, py);
      ctx.moveTo(px, py - 7);
      ctx.lineTo(px, py + 7);
      ctx.stroke();
    }

    const now = performance.now();
    if (now - lastPanel.current > PANEL_MS) {
      lastPanel.current = now;
      near.sort((a, b) => a.d - b.d);
      // nearest five, but listed in field order so the rows hold their place
      // instead of reshuffling every refresh
      const next = near
        .slice(0, 5)
        .sort((a, b) => a.i - b.i)
        .map((n) => describe(n.i));
      setHits((prev) => (prev.length === next.length && prev.every((p, k) => p.key === next[k].key) ? prev : next));
      setCount((prev) => (prev.priced === priced && prev.total === cols * rows ? prev : { priced, total: cols * rows }));
    }
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let hovering = false;
    const t0 = performance.now();

    const frame = () => {
      // with no cursor in the field the lens keeps working on its own, so the
      // section is never dead on arrival
      if (!hovering) {
        const t = (performance.now() - t0) / 9000;
        const r = wrap.getBoundingClientRect();
        pointer.current = {
          x: r.width * (0.5 + 0.33 * Math.cos(t * Math.PI * 2)),
          y: r.height * (0.5 + 0.3 * Math.sin(t * Math.PI * 2 * 1.37)),
          live: true,
        };
      }
      draw();
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      hovering = true;
      pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top, live: true };
    };
    const onLeave = () => {
      hovering = false;
    };

    if (reduced) {
      pointer.current = { x: -999, y: -999, live: false };
      draw();
    } else {
      raf = requestAnimationFrame(frame);
      wrap.addEventListener("pointermove", onMove);
      wrap.addEventListener("pointerleave", onLeave);
    }
    window.addEventListener("resize", draw);
    return () => {
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", draw);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [draw]);

  return (
    <Plate id="Coverage" caption={`${count.priced} / ${count.total}`}>
      <div ref={wrapRef} className="relative h-[340px] w-full cursor-crosshair touch-none md:h-[420px]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <div className="pointer-events-none absolute right-0 top-0 w-[236px] border-l border-hairline bg-background/85 backdrop-blur-[1px] md:w-[268px]">
          <div className="border-b border-hairline px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-tint-400">
            Under lens
          </div>
          <ul className="flex flex-col">
            {hits.map((hit) => (
              <li
                key={hit.key}
                className="bl-row-in flex items-baseline justify-between gap-3 border-b border-hairline-soft px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12px] leading-tight">{hit.cat}</span>
                  <span className="block truncate font-mono text-[9px] uppercase tracking-[0.1em] text-tint-400">
                    {hit.tract} · {hit.conf}%
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-accent">{hit.value}</span>
              </li>
            ))}
            {hits.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="border-b border-hairline-soft px-3 py-2">
                    <span className="font-mono text-[11px] text-tint-300">&mdash;</span>
                  </li>
                ))
              : null}
          </ul>
        </div>
      </div>
    </Plate>
  );
}
