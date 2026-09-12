"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Radio } from "lucide-react";
import createGlobe, { type Globe } from "cobe";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import "./landing.css";

type Hub = {
  id: string;
  city: string;
  region: string;
  location: [number, number];
  count: number;
  focus: string;
  query: string;
  showInSidebar?: boolean;
};

const HUBS: Hub[] = [
  { id: "seattle", city: "Seattle", region: "WA", location: [47.6062, -122.3321], count: 24, focus: "Services", query: "service businesses in Seattle, WA" },
  { id: "sf", city: "San Francisco", region: "CA", location: [37.7749, -122.4194], count: 31, focus: "Retail", query: "retail businesses in San Francisco, CA" },
  { id: "la", city: "Los Angeles", region: "CA", location: [34.0522, -118.2437], count: 46, focus: "Food and retail", query: "small businesses in Los Angeles, CA" },
  { id: "austin", city: "Austin", region: "TX", location: [30.2672, -97.7431], count: 29, focus: "Home services", query: "home service businesses in Austin, TX" },
  { id: "chicago", city: "Chicago", region: "IL", location: [41.8781, -87.6298], count: 37, focus: "Manufacturing", query: "manufacturing businesses in Chicago, IL" },
  { id: "pittsburgh", city: "Pittsburgh", region: "PA", location: [40.4406, -79.9959], count: 12, focus: "Local operators", query: "laundromat in Pittsburgh" },
  { id: "new-york", city: "New York", region: "NY", location: [40.7128, -74.006], count: 54, focus: "Neighborhood retail", query: "small businesses in New York, NY" },
  { id: "miami", city: "Miami", region: "FL", location: [25.7617, -80.1918], count: 28, focus: "Hospitality", query: "hospitality businesses in Miami, FL" },
  { id: "denver", city: "Denver", region: "CO", location: [39.7392, -104.9903], count: 21, focus: "Trade services", query: "trade service businesses in Denver, CO", showInSidebar: false },
  { id: "atlanta", city: "Atlanta", region: "GA", location: [33.749, -84.388], count: 34, focus: "Business services", query: "business service companies in Atlanta, GA", showInSidebar: false },
  { id: "boston", city: "Boston", region: "MA", location: [42.3601, -71.0589], count: 27, focus: "Local operators", query: "small businesses in Boston, MA", showInSidebar: false },
];

function globeMarkers(activeId: string) {
  return HUBS.map((hub) => ({
    location: hub.location,
    size: hub.id === activeId ? 0.046 : 0.024,
    color: hub.id === activeId
      ? [1, 1, 1] as [number, number, number]
      : [0.39, 0.27, 0.96] as [number, number, number],
    id: hub.id,
  }));
}

function globeArcs(activeId: string) {
  const selected = HUBS.find((hub) => hub.id === activeId) ?? HUBS[5];
  return HUBS.filter((hub) => hub.id !== selected.id).map((hub) => ({
    from: selected.location,
    to: hub.location,
    color: [0.45, 0.34, 0.96] as [number, number, number],
  }));
}

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

const INITIAL_VIEW = { phi: locationToAngles([38.5, -97.5])[0], theta: 0.42 };

export function DiscoveryMap() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const dragStart = useRef<number | null>(null);
  const dragPhi = useRef(0);
  const current = useRef({ ...INITIAL_VIEW });
  const target = useRef({ ...INITIAL_VIEW });
  const [active, setActive] = useState(HUBS[5]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    let frame = 0;
    let size = Math.min(host.clientWidth, 560);
    const dpr = Math.min(window.devicePixelRatio, 2);
    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi: current.current.phi,
      theta: current.current.theta,
      dark: 0,
      diffuse: 1.45,
      mapSamples: 42_000,
      mapBrightness: 5.5,
      mapBaseBrightness: 0.12,
      baseColor: [0.72, 0.67, 1],
      markerColor: [0.39, 0.27, 0.96],
      glowColor: [0.96, 0.95, 1],
      markers: globeMarkers("pittsburgh"),
      arcs: globeArcs("pittsburgh"),
      arcColor: [0.45, 0.34, 0.96],
      arcWidth: 0.24,
      arcHeight: 0.12,
      markerElevation: 0.035,
      opacity: 0.9,
      scale: 1.28,
    });
    globeRef.current = globe;
    canvas.style.opacity = "1";

    const render = () => {
      current.current.phi += (target.current.phi - current.current.phi) * 0.075;
      current.current.theta += (target.current.theta - current.current.theta) * 0.075;
      globe.update({
        width: size * dpr,
        height: size * dpr,
        phi: current.current.phi,
        theta: current.current.theta,
      });
      frame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(() => {
      size = Math.min(host.clientWidth, 560);
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
    const globe = globeRef.current;
    if (!globe) return;
    const arcs = globeArcs(active.id);
    globe.update({ markers: globeMarkers(active.id), arcs: [] });
    const timers = arcs.map((_, index) =>
      window.setTimeout(() => globe.update({ arcs: arcs.slice(0, index + 1) }), 55 * index),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [active.id]);

  function selectHub(hub: Hub) {
    setActive(hub);
    const [phi, theta] = locationToAngles(hub.location);
    target.current = {
      phi: nearestRotation(current.current.phi, phi),
      theta: Math.min(theta, 0.56),
    };
  }

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    dragStart.current = event.clientX;
    dragPhi.current = target.current.phi;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (dragStart.current === null) return;
    target.current.phi = dragPhi.current + (event.clientX - dragStart.current) / 180;
  }

  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    dragStart.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <section className="mt-2 border-t border-line pt-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label>World discovery</Label>
          <span className="font-mono text-[10px] text-muted-foreground">United States focus</span>
        </div>
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
          <Radio className="size-3 animate-pulse" />
          11 markets
        </span>
      </div>

      <div className="bl-liquid-shell relative overflow-hidden border border-white/70">
        <div
          ref={hostRef}
          className="bl-globe-stage relative flex min-h-[460px] items-center justify-center overflow-hidden md:min-h-[620px]"
        >
          <div className="bl-satellite-texture absolute inset-0" />
          <div className="absolute left-1/2 top-1/2 size-[72%] -translate-x-1/2 -translate-y-1/2 bg-white/70 blur-[100px] lg:left-[32%]" />
          <div className="bl-globe-orbit absolute left-1/2 top-1/2 aspect-square w-[47%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/15 lg:left-[32%]" />
          <canvas
            ref={canvasRef}
            className={cn(
              "relative z-10 touch-none opacity-0 transition-opacity duration-500 lg:absolute lg:left-[32%] lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2",
              dragging ? "cursor-grabbing" : "cursor-grab",
            )}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
          />
          <div className="bl-liquid-highlight pointer-events-none absolute inset-x-[8%] top-0 h-[38%]" />
          <div className="pointer-events-none absolute bottom-4 left-5 font-mono text-[9px] uppercase tracking-[0.1em] text-primary/40">
            Drag to rotate
          </div>
          <div className="pointer-events-none absolute bottom-4 right-5 font-mono text-[9px] text-primary/40">
            Global coverage
          </div>
        </div>

        <aside className="bl-liquid-panel flex flex-col border-t border-white/70 text-primary lg:absolute lg:bottom-5 lg:right-5 lg:top-5 lg:w-[270px] lg:border">
          <div className="border-b border-accent/10 p-5">
            <Label>Selected city</Label>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[25px] text-primary">{active.city}</h2>
                <p className="mt-1 text-[13px] text-primary/55">{active.focus}</p>
              </div>
              <span className="border border-accent/25 bg-white/35 px-2 py-1 font-mono text-[10px] text-accent-deep">
                {active.region}
              </span>
            </div>
            <dl className="mt-5 border-t border-accent/10 pt-4">
              <dt className="font-mono text-[9px] uppercase tracking-[0.1em] text-primary/40">Tracked businesses</dt>
              <dd className="mt-1 font-mono text-[22px] tabular-nums text-primary">{active.count}</dd>
            </dl>
            <Button
              variant="primary"
              className="mt-5 w-full justify-between bg-accent"
              onClick={() => router.push(`/search?q=${encodeURIComponent(active.query)}`)}
            >
              Explore city
              <ArrowUpRight />
            </Button>
          </div>

          <div className="grid flex-1 grid-cols-2 content-start gap-px bg-accent/10 p-px lg:grid-cols-1">
            {HUBS.filter((hub) => hub.showInSidebar !== false).map((hub) => (
              <button
                key={hub.id}
                type="button"
                onClick={() => selectHub(hub)}
                className={cn(
                  "flex items-center justify-between bg-white/35 px-4 py-2.5 text-left transition-colors hover:bg-white/65",
                  active.id === hub.id && "bl-city-selected bg-accent/[0.10]",
                )}
              >
                <span className={cn("text-[12px]", active.id === hub.id ? "text-primary" : "text-primary/55")}>
                  {hub.city}
                </span>
                <span className="font-mono text-[9px] tabular-nums text-accent-deep/60">{hub.count}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
