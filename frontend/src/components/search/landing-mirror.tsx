"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import "./landing.css";

const FOG = "242, 242, 242";
const BRUSH = 44;
const FADE = 0.005; // per frame, so a wiped patch is gone in roughly fifteen seconds

type Tile = { cat: string; where: string; value: string };

/**
 * Category and neighbourhood only, because a business that nobody lists is
 * anonymous by definition. That anonymity is the point of the section, so no
 * names are invented here.
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
  { cat: "Auto body", where: "Munhall", value: "$1.18M" },
  { cat: "Deli", where: "Bloomfield", value: "$311K" },
  { cat: "Landscaping", where: "Whitehall", value: "$742K" },
  { cat: "Tire shop", where: "Brentwood", value: "$688K" },
  { cat: "Laundromat", where: "Mount Oliver", value: "$357K" },
  { cat: "Sign shop", where: "Aspinwall", value: "$596K" },
  { cat: "Plumbing", where: "Sewickley", value: "$2.05M" },
];

/**
 * A fogged mirror over the part of the market nobody can see.
 *
 * Three layers, and the reason is a real bug: hazing back by stacking a
 * translucent fill over the visible canvas every frame drifts the colour grey,
 * because 8 bit premultiplied storage rounds at very low alpha and the error
 * compounds over hundreds of frames. So the fog is painted once, off screen,
 * and never touched. What decays is a separate wipe mask, which only carries
 * alpha, and the visible canvas is rebuilt from the pristine fog each frame.
 * The fog that returns is byte for byte the fog that was there.
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canvas.style.display = "none";
      const t = setTimeout(() => setCleared(1), 0);
      return () => clearTimeout(t);
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fog = document.createElement("canvas");
    const mask = document.createElement("canvas");
    const fogCtx = fog.getContext("2d")!;
    const maskCtx = mask.getContext("2d")!;
    const sample = document.createElement("canvas");
    sample.width = 40;
    sample.height = 24;
    const sCtx = sample.getContext("2d", { willReadFrequently: true })!;

    let w = 0;
    let h = 0;

    /** Paint the fog once. Nothing ever draws onto it again. */
    const build = () => {
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      for (const c of [canvas, fog, mask]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      for (const c of [ctx, fogCtx, maskCtx]) c.setTransform(dpr, 0, 0, dpr, 0, 0);

      fogCtx.clearRect(0, 0, w, h);
      fogCtx.fillStyle = `rgba(${FOG}, 0.982)`;
      fogCtx.fillRect(0, 0, w, h);
      for (let i = 0; i < (w * h) / 1400; i++) {
        const a = 0.1 + Math.random() * 0.16;
        fogCtx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(210,210,222,${a})`;
        const r = 1 + Math.random() * 2.4;
        fogCtx.fillRect(Math.random() * w, Math.random() * h, r, r);
      }
      maskCtx.clearRect(0, 0, w, h);
      last.current = null;
    };
    build();

    /** One swipe of a hand. It writes into the mask, never into the fog. */
    const wipe = (x: number, y: number) => {
      const from = last.current ?? { x, y };
      const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 7));
      maskCtx.globalCompositeOperation = "source-over";
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = from.x + (x - from.x) * t;
        const cy = from.y + (y - from.y) * t;
        const r = BRUSH * (0.82 + Math.random() * 0.3);
        const g = maskCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(255,255,255,0.5)");
        g.addColorStop(0.55, "rgba(255,255,255,0.26)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        maskCtx.fillStyle = g;
        maskCtx.beginPath();
        maskCtx.arc(cx, cy, r, 0, Math.PI * 2);
        maskCtx.fill();
      }
      last.current = { x, y };
    };

    let raf = 0;
    let lastMeasure = 0;

    const frame = (now: number) => {
      // the mirror hazes back over: the mask decays, the fog itself is untouched
      maskCtx.globalCompositeOperation = "destination-out";
      maskCtx.fillStyle = `rgba(0,0,0,${FADE})`;
      maskCtx.fillRect(0, 0, w, h);
      maskCtx.globalCompositeOperation = "source-over";

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(fog, 0, 0, w, h);
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(mask, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      if (now - lastMeasure > 450) {
        lastMeasure = now;
        sCtx.clearRect(0, 0, 40, 24);
        sCtx.drawImage(mask, 0, 0, 40, 24);
        const d = sCtx.getImageData(0, 0, 40, 24).data;
        let open = 0;
        for (let i = 3; i < d.length; i += 4) open += d[i] / 255;
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
        const t0 = performance.now();
        const stroke = (t: number) => {
          const p = Math.min(1, (t - t0) / 1500);
          const e = 1 - Math.pow(1 - p, 3);
          wipe(w * (0.12 + 0.62 * e), h * (0.32 + 0.26 * Math.sin(e * Math.PI * 1.25)));
          if (p < 1) requestAnimationFrame(stroke);
          else last.current = null;
        };
        requestAnimationFrame(stroke);
      },
      { threshold: 0.3 },
    );
    io.observe(wrap);

    const ro = new ResizeObserver(build);
    ro.observe(wrap);

    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    return () => {
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      io.disconnect();
      ro.disconnect();
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
