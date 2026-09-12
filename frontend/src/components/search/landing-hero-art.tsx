"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import createGlobe, { type Globe } from "cobe";
import { cn } from "@/lib/cn";
import "./landing.css";

type Spot = {
  city: string;
  location: [number, number];
  count: number;
  lead: string;
  last: number;
};

const SPOTS: Spot[] = [
  { city: "Pittsburgh", location: [40.4406, -79.9959], count: 12, lead: "Squirrel Hill Wash and Fold", last: 56.4 },
  { city: "Miami", location: [25.7617, -80.1918], count: 28, lead: "Little Havana Wash and Fold", last: 41.2 },
  { city: "Austin", location: [30.2672, -97.7431], count: 19, lead: "East Cesar Chavez Laundry", last: 38.8 },
  { city: "Chicago", location: [41.8781, -87.6298], count: 37, lead: "Pilsen Coin Laundry", last: 44.1 },
  { city: "Los Angeles", location: [34.0522, -118.2437], count: 46, lead: "Echo Park Wash House", last: 62.5 },
  { city: "New York", location: [40.7128, -74.006], count: 54, lead: "Greenpoint Wash and Fold", last: 71.0 },
];

const HOP_MS = 2200;
const LINGER_MS = 2800;
const RESUME_MS = 10_000;
const GLOBE_PX = 640;

function locationToAngles([lat, lng]: [number, number]) {
  const phi = (Math.PI - (lng * Math.PI / 180 - Math.PI / 2)) % (Math.PI * 2);
  const theta = lat * Math.PI / 180;
  return [phi, theta] as const;
}

function nearestRotation(from: number, to: number) {
  let next = to;
  while (next - from > Math.PI) next -= Math.PI * 2;
  while (next - from < -Math.PI) next += Math.PI * 2;
  return next;
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function markersFor(active: number, sizes: number[]) {
  return SPOTS.map((spot, i) => ({
    location: spot.location,
    size: sizes[i] ?? (i === active ? 0.055 : 0.02),
    color: (i === active ? [1, 1, 1] : [0.39, 0.27, 0.96]) as [number, number, number],
  }));
}

function arcsFor(active: number) {
  const from = SPOTS[active].location;
  return [2, 3].map((step) => {
    const spot = SPOTS[(active + step) % SPOTS.length];
    return {
      from,
      to: spot.location,
      color: [0.45, 0.34, 0.96] as [number, number, number],
    };
  });
}

/**
 * Compact WebGL earth in the landing hero column. Slow drift, then a long
 * ease to the next live city while the book line stays in one sentence.
 */
export function LandingHeroArt() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const activeRef = useRef(0);
  const sizes = useRef<number[]>(SPOTS.map((_, i) => (i === 0 ? 0.055 : 0.02)));
  const pose = useRef({
    phi: locationToAngles(SPOTS[0].location)[0],
    theta: 0.4,
  });
  const travel = useRef<{
    fromPhi: number;
    fromTheta: number;
    toPhi: number;
    toTheta: number;
    start: number;
    duration: number;
  } | null>(null);
  const held = useRef(false);
  const drag = useRef<{ x: number; y: number; phi: number; theta: number } | null>(null);
  const resumeTimer = useRef(0);
  const [active, setActive] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [print, setPrint] = useState(SPOTS[0].last);
  const [flashed, setFlashed] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    let size = Math.min(host.clientWidth, GLOBE_PX);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi: pose.current.phi,
      theta: pose.current.theta,
      dark: 0,
      diffuse: 1.55,
      mapSamples: 42_000,
      mapBrightness: 5.4,
      mapBaseBrightness: 0.1,
      baseColor: [0.72, 0.67, 1],
      markerColor: [0.39, 0.27, 0.96],
      glowColor: [0.96, 0.95, 1],
      markers: markersFor(0, sizes.current),
      arcs: arcsFor(0),
      arcColor: [0.45, 0.34, 0.96],
      arcWidth: 0.22,
      arcHeight: 0.16,
      markerElevation: 0.045,
      opacity: 0.94,
      scale: 1,
    });
    globeRef.current = globe;
    canvas.style.opacity = "1";

    let frame = 0;
    const render = (now: number) => {
      const hop = travel.current;
      if (held.current || reduced) {
        // user has the globe, or motion is off
      } else if (hop) {
        const t = Math.min((now - hop.start) / hop.duration, 1);
        const e = easeInOut(t);
        pose.current.phi = lerp(hop.fromPhi, hop.toPhi, e);
        pose.current.theta = lerp(hop.fromTheta, hop.toTheta, e);
        if (t >= 1) travel.current = null;
      } else {
        pose.current.phi += 0.00105;
        const breathe = 0.4 + Math.sin(now / 5200) * 0.018;
        pose.current.theta += (breathe - pose.current.theta) * 0.02;
      }

      sizes.current = sizes.current.map((sizeNow, i) =>
        lerp(sizeNow, i === activeRef.current ? 0.058 : 0.02, 0.06),
      );

      globe.update({
        width: size * dpr,
        height: size * dpr,
        phi: pose.current.phi,
        theta: pose.current.theta,
        markers: markersFor(activeRef.current, sizes.current),
      });
      frame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(() => {
      size = Math.min(host.clientWidth, GLOBE_PX);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    });
    observer.observe(host);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    frame = window.requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      globe.destroy();
      globeRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !autoplay) return;
    let timeout = 0;
    const hop = () => {
      setLeaving(true);
      timeout = window.setTimeout(() => {
        const next = (activeRef.current + 1) % SPOTS.length;
        setActive(next);
        setPrint(SPOTS[next].last);
        setLeaving(false);
        timeout = window.setTimeout(hop, HOP_MS + LINGER_MS);
      }, 720);
    };
    timeout = window.setTimeout(hop, LINGER_MS);
    return () => window.clearTimeout(timeout);
  }, [autoplay]);

  function hold() {
    held.current = true;
    travel.current = null;
    setLeaving(false);
    setAutoplay(false);
    window.clearTimeout(resumeTimer.current);
  }

  function release() {
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      held.current = false;
      setAutoplay(true);
    }, RESUME_MS);
  }

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    hold();
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      phi: pose.current.phi,
      theta: pose.current.theta,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    pose.current.phi = drag.current.phi + (event.clientX - drag.current.x) / 180;
    pose.current.theta = Math.min(
      0.72,
      Math.max(0.12, drag.current.theta + (event.clientY - drag.current.y) / 240),
    );
  }

  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    release();
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  useEffect(() => {
    const globe = globeRef.current;
    const [phi, theta] = locationToAngles(SPOTS[active].location);
    travel.current = {
      fromPhi: pose.current.phi,
      fromTheta: pose.current.theta,
      toPhi: nearestRotation(pose.current.phi, phi),
      toTheta: Math.min(Math.max(theta, 0.28), 0.5),
      start: performance.now(),
      duration: HOP_MS,
    };
    if (!globe) return;
    globe.update({ arcs: [] });
    const next = arcsFor(active);
    const timers = next.map((_, i) =>
      window.setTimeout(() => globe.update({ arcs: next.slice(0, i + 1) }), 180 + 160 * i),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      setPrint((n) => {
        const step = (Math.random() - 0.4) * 0.28;
        return Math.round((n + step) * 100) / 100;
      });
      setFlashed(true);
      window.setTimeout(() => setFlashed(false), 420);
    }, 1700);
    return () => window.clearInterval(id);
  }, [active]);

  const spot = SPOTS[active];

  return (
    <div className="pointer-events-none absolute inset-0 hidden xl:block">
      <div className="absolute inset-y-0 right-0 flex w-[50%] items-center justify-center">
        <div className="relative flex w-[640px] max-w-full -translate-x-1 flex-col items-center">
          <div className="pointer-events-auto relative z-20 -mb-[52px] w-[288px] border border-line bg-card px-4 py-3 shadow-sm">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
              <span className="bl-hub-pulse size-2 rounded-full bg-accent" />
              Live
            </p>
            <div className={`bl-hero-copy mt-2.5 min-h-[42px] ${leaving ? "is-leaving" : ""}`}>
              <p className="text-[14px] leading-[1.3] text-foreground">
                {spot.count} bidding in {spot.city}
              </p>
              <p className="mt-1 flex items-baseline justify-between gap-3 text-[12px] text-muted-foreground">
                <span className="truncate">{spot.lead}</span>
                <span className={`shrink-0 font-mono tabular-nums text-foreground ${flashed ? "bl-tick-up" : ""}`}>
                  {money(print)}
                </span>
              </p>
            </div>
          </div>

          <div ref={hostRef} className="pointer-events-auto relative mx-auto aspect-square w-full">
            <div className="absolute left-1/2 top-1/2 size-[78%] -translate-x-1/2 -translate-y-1/2 bg-white/80 blur-[64px]" />
            <div className="bl-liquid-highlight pointer-events-none absolute inset-x-[12%] top-[8%] h-[34%]" />
            <canvas
              ref={canvasRef}
              className={cn(
                "relative z-10 mx-auto block touch-none opacity-0 transition-opacity duration-700",
                dragging ? "cursor-grabbing" : "cursor-grab",
              )}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
