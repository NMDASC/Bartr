"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { Portfolio } from "@contracts/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getPortfolio } from "@/lib/api";
import { headline, type Deal } from "@/lib/closing";
import { pct, usd } from "@/lib/format";

const COLORS = ["#755cfe", "#2bc392", "#1d1956", "#5d4ee7", "#ffffff", "#ee5557"];
const REDIRECT_S = 12;

/** Canvas confetti, no dependency. Stops on its own and respects reduced motion. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);
    const w = () => window.innerWidth;
    const pieces = Array.from({ length: 220 }, (_, i) => ({
      x: w() * (0.2 + Math.random() * 0.6),
      y: -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 6,
      vy: 2 + Math.random() * 5,
      size: 6 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[i % COLORS.length],
      tall: Math.random() > 0.5,
    }));
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, w(), window.innerHeight);
      const alpha = t > 4.5 ? Math.max(0, 1 - (t - 4.5) / 1.2) : 1;
      ctx.globalAlpha = alpha;
      for (const p of pieces) {
        p.vy += 0.06;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.tall ? p.size / 2 : p.size / 3);
        ctx.restore();
      }
      if (t < 6) frame = window.requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w(), window.innerHeight);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-40 h-full w-full" />;
}

export function Celebration({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [checked, setChecked] = useState(false);
  const [left, setLeft] = useState(REDIRECT_S);

  // The fill already landed on the account. Read it back so the page shows the
  // real position, and retry briefly in case the ledger is a beat behind.
  useEffect(() => {
    if (deal.kind !== "shares") return;
    let alive = true;
    let attempts = 0;
    const look = async () => {
      attempts += 1;
      try {
        const p = await getPortfolio();
        if (!alive) return;
        setPortfolio(p);
        const has = p.positions.some((x) => x.market_id === deal.companyId);
        if (!has && attempts < 4) {
          window.setTimeout(look, 1200);
          return;
        }
      } catch {
        if (alive && attempts < 4) {
          window.setTimeout(look, 1200);
          return;
        }
      }
      if (alive) setChecked(true);
    };
    void look();
    return () => {
      alive = false;
    };
  }, [deal.companyId, deal.kind]);

  useEffect(() => {
    const id = window.setInterval(() => setLeft((n) => n - 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (left > 0) return;
    router.push("/overview");
  }, [left, router]);

  const position = portfolio?.positions.find((p) => p.market_id === deal.companyId) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 xl:border-x xl:border-line 3xl:max-w-8xl">
      <Confetti />
      <div className="bartr-fade-up pb-8 pt-16 md:pt-24">
        <Label className="mb-4 block">{deal.kind === "whole" ? "Acquisition closed" : "Shares transferred"}</Label>
        <h1 className="max-w-4xl text-[40px] leading-[1.02] tracking-[-0.02em] md:text-[64px] 3xl:text-[76px]">
          {headline(deal)}
        </h1>
        <p className="mt-6 max-w-2xl text-[18px] leading-[1.4] secondary">
          {deal.kind === "whole"
            ? `${deal.companyName} in ${deal.place} is yours. The papers are signed and the purchase price is settled.`
            : `You now hold ${pct(deal.pct, deal.pct < 0.1 ? 2 : 1)} of ${deal.companyName} in ${deal.place}. The papers are signed and the shares are in your portfolio.`}
        </p>
      </div>

      <dl className="grid border-y border-line sm:grid-cols-4 sm:divide-x sm:divide-line">
        {[
          [deal.kind === "whole" ? "Purchase" : "Shares", deal.kind === "whole" ? "Whole business" : deal.qty.toLocaleString("en-US")],
          ["Stake", pct(deal.pct, deal.pct < 0.1 ? 2 : 1)],
          [deal.kind === "whole" ? "Price" : "Per share", deal.kind === "whole" ? usd(deal.price, { cents: false }) : usd(deal.price)],
          ["Total", usd(deal.total, { cents: deal.kind !== "whole" })],
        ].map(([label, value]) => (
          <div key={label} className="border-b border-line p-4 sm:border-b-0">
            <dt>
              <Label tracking="tight" className="mb-2 block">
                {label}
              </Label>
            </dt>
            <dd className="font-mono text-[22px] tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {deal.kind === "shares" ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-line bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className={`size-2.5 ${position ? "bg-up" : checked ? "bg-accent" : "bg-tint-400 animate-pulse"}`} />
            <span className="text-[15px]">
              {position
                ? `In your portfolio: ${position.qty.toLocaleString("en-US")} shares of ${position.name}, ${usd(position.value)} at the last print.`
                : checked
                  ? "Recorded on your account. The position appears on your overview after the next print."
                  : "Recording on your account"}
            </span>
          </div>
          <Link href="/overview" className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep underline underline-offset-4">
            Overview
          </Link>
        </div>
      ) : null}

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Button variant="primary" size="lg" href="/overview">
          Go to overview
        </Button>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Overview in {Math.max(0, left)}s
        </span>
      </div>
    </div>
  );
}
