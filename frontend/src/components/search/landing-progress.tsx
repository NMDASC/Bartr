"use client";

import { useEffect, useState } from "react";
import "./landing.css";

/** One hairline across the top of the viewport, tracking how far down the page you are. */
export function LandingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const travel = document.documentElement.scrollHeight - window.innerHeight;
      setP(travel <= 0 ? 0 : Math.min(1, window.scrollY / travel));
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
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-px">
      <div className="bl-progress h-px w-full bg-accent" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}
