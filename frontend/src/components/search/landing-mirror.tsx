"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import "./landing.css";

const FOG = [242, 242, 242];
const BRUSH = 44;

type Tile = { cat: string; where: string; value: string };

/**
 * Thirty five of them, category and neighbourhood only, because a business that
 * nobody lists is anonymous by definition. That anonymity is the point of the
 * section, so no names are invented here.
 */
const TILES: Tile[] = [
  { cat: "Laundromat", where: "Squirrel Hill", value: "$558K" },
  { cat: "Car wash", where: "McKnight Rd", value: "$1.24M" },
  { cat: "Machine shop", where: "McKees Rocks", value: "$2.10M" },
  { cat: "Dry cleaner", where: "Shadyside", value: "$812K" },
  { cat: "Auto body", where: "Lawrenceville", value: "$1.46M" },
  { cat: "Self storage", where: "Homestead", value: "$3.35M" },
  { cat: "Bakery", where: "Bloomfield", value: "$615K" },
  { cat: "HVAC", where: "Carnegie", value: "$2.74M" },
  { cat: "Print shop", where: "Oakland", value: "$930K" },
  { cat: "Vending route", where: "Strip District", value: "$405K" },
  { cat: "Laundromat", where: "Brookline", value: "$472K" },
  { cat: "Tree service", where: "Mt. Lebanon", value: "$1.08M" },
  { cat: "Sign shop", where: "Swissvale", value: "$690K" },
  { cat: "Car wash", where: "Baldwin", value: "$980K" },
  { cat: "Pest control", where: "Ross Twp", value: "$1.91M" },
  { cat: "Tool and die", where: "Braddock", value: "$3.02M" },
  { cat: "Deli", where: "Polish Hill", value: "$340K" },
  { cat: "Locksmith", where: "Greenfield", value: "$286K" },
  { cat: "Upholstery", where: "Sharpsburg", value: "$431K" },
  { cat: "Tire shop", where: "Hazelwood", value: "$755K" },
  { cat: "Plumbing", where: "Bellevue", value: "$2.21M" },
  { cat: "Laundromat", where: "Beechview", value: "$389K" },
  { cat: "Machine shop", where: "Etna", value: "$1.77M" },
  { cat: "Florist", where: "Highland Park", value: "$268K" },
  { cat: "Barber shop", where: "Garfield", value: "$194K" },
  { cat: "Auto glass", where: "West End", value: "$864K" },
  { cat: "Catering", where: "Bloomfield", value: "$1.12M" },
  { cat: "Welding", where: "Rankin", value: "$1.35M" },
  { cat: "Car wash", where: "Penn Hills", value: "$1.03M" },
  { cat: "Nursery", where: "Verona", value: "$2.48M" },
  { cat: "Dry cleaner", where: "Dormont", value: "$523K" },
  { cat: "Print shop", where: "Millvale", value: "$611K" },
  { cat: "Storage", where: "Wilkinsburg", value: "$2.96M" },
  { cat: "Bakery", where: "Brighton Hts", value: "$402K" },
  { cat: "Machine shop", where: "Crafton", value: "$1.64M" },
];

/**
 * A fogged mirror over the part of the market nobody can see. The fog only
 * lifts where a hand goes, it stays lifted, and it hazes back over the next
 * half minute, so the state of the panel is a record of where the reader has
 * actually looked rather than an effect playing on a loop.
 */
export function LandingMirror() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const demoed = useRef(false);
  const [cleared, setCleared] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      canvas.style.display = "none";
      setCleared(1);
      return;
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const sample = document.createElement("canvas");
    sample.width = 40;
    sample.height = 24;
    const sctx = sample.getContext("2d", { willReadFrequently: true });

    /** Flat fog with a frost grain worked into it, laid down once. */
    const lay = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${FOG[0]}, ${FOG[1]}, ${FOG[2]}, 0.982)`;
      ctx.fillRect(0, 0, w, h);
      // grain, so the fog reads as frost rather than a flat sheet
      for (let i = 0; i < (w * h) / 1400; i++) {
        const a = 0.1 + Math.random() * 0.16;
        ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(210,210,222,${a})`;
        const r = 1 + Math.random() * 2.4;
        ctx.fillRect(Math.random() * w, Math.random() * h, r, r);
      }
      last.current = null;
    };
    lay();

    /** One swipe of a hand: soft, slightly ragged, erasing rather than painting. */
    const wipe = (x: number, y: number) => {
      const from = last.current ?? { x, y };
      const dist = Math.hypot(x - from.x, y - from.y);
      const steps = Math.max(1, Math.ceil(dist / 7));
      ctx.globalCompositeOperation = "destination-out";
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = from.x + (x - from.x) * t;
        const cy = from.y + (y - from.y) * t;
        const r = BRUSH * (0.82 + Math.random() * 0.3);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(0,0,0,0.62)");
        g.addColorStop(0.55, "rgba(0,0,0,0.34)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      last.current = { x, y };
    };

    let raf = 0;
    let lastMeasure = 0;

    const frame = (now: number) => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      // the mirror hazes back over, the way one does
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${FOG[0]}, ${FOG[1]}, ${FOG[2]}, 0.0026)`;
      ctx.fillRect(0, 0, w, h);

      if (sctx && now - lastMeasure > 450) {
        lastMeasure = now;
        sctx.clearRect(0, 0, 40, 24);
        sctx.drawImage(canvas, 0, 0, 40, 24);
        const d = sctx.getImageData(0, 0, 40, 24).data;
        let open = 0;
        for (let i = 3; i < d.length; i += 4) open += 1 - d[i] / 255;
        setCleared(open / (40 * 24));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      wipe(e.clientX - r.left, e.clientY - r.top);
    };
    const onLeave = () => {
      last.current = null;
    };

    /**
     * One stroke, once, when the reader arrives. It is the affordance: without
     * it nobody knows the panel can be wiped. It does not repeat.
     */
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || demoed.current) return;
        demoed.current = true;
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        const t0 = performance.now();
        const dur = 1500;
        const stroke = (now: number) => {
          const t = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - t, 3);
          wipe(w * (0.12 + 0.62 * e), h * (0.34 + 0.3 * Math.sin(e * Math.PI * 1.25)));
          if (t < 1) requestAnimationFrame(stroke);
          else last.current = null;
        };
        requestAnimationFrame(stroke);
      },
      { threshold: 0.4 },
    );
    io.observe(wrap);

    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", lay);
    return () => {
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", lay);
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-4">
        <Label tracking="normal">Pittsburgh metro</Label>
        <span className="font-mono text-[10px] tabular-nums uppercase tracking-[0.12em] text-muted-foreground">
          {Math.round(cleared * 100)}% visible
        </span>
      </div>

      <div ref={wrapRef} className="relative touch-none select-none border-t border-line" style={{ cursor: "crosshair" }}>
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
          {TILES.map((t, i) => (
            <div key={i} className="bg-background px-3 py-4">
              <div className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{t.cat}</div>
              <div className="mt-1 truncate text-[14px] leading-tight">{t.where}</div>
              <div className="mt-1.5 font-mono text-[12px] tabular-nums">{t.value}</div>
            </div>
          ))}
        </div>
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
