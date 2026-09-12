"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, LineSeries, LineType, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import type { Batch } from "@contracts/types";

/** Step line: one price per batch, held until the next round clears. */
export function PriceChart({ batches, refPrice }: { batches: Batch[]; refPrice: number | null }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Line"> | null>(null);
  const refLine = useRef<ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#6c6991",
        fontFamily: "var(--font-plex-mono), 'IBM Plex Mono', ui-monospace, monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: { vertLines: { color: "#f3f3fc" }, horzLines: { color: "#e6e6ef" } },
      rightPriceScale: { borderColor: "#d4d4dd", scaleMargins: { top: 0.15, bottom: 0.15 } },
      timeScale: { borderColor: "#d4d4dd", timeVisible: true, secondsVisible: true, rightOffset: 2 },
      crosshair: {
        vertLine: { color: "#a1a0b8", width: 1, style: 3, labelBackgroundColor: "#1d1956" },
        horzLine: { color: "#a1a0b8", width: 1, style: 3, labelBackgroundColor: "#1d1956" },
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: false },
    });
    const s = c.addSeries(LineSeries, {
      color: "#755cfe",
      lineWidth: 1,
      lineType: LineType.WithSteps,
      priceLineColor: "#755cfe",
      priceLineStyle: 3,
      lastValueVisible: true,
      crosshairMarkerRadius: 3,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    chart.current = c;
    series.current = s;
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
      refLine.current = null;
    };
  }, []);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    s.setData(batches.map((b) => ({ time: Math.floor(Date.parse(b.t) / 1000) as UTCTimestamp, value: b.clearing_price })));
    chart.current?.timeScale().fitContent();
  }, [batches]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    if (refLine.current) s.removePriceLine(refLine.current);
    if (refPrice !== null) {
      refLine.current = s.createPriceLine({ price: refPrice, color: "#a1a0b8", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "model" });
    }
  }, [refPrice]);

  return <div ref={el} className="h-[260px] md:h-[320px] w-full" role="img" aria-label="Clearing price by batch" />;
}
