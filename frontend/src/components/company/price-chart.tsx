"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, LineSeries, LineType, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import type { Batch } from "@contracts/types";

/** Step line: one price per batch, held until the next round clears. */
export function PriceChart({ batches, refPrice, rangeKey = "all" }: { batches: Batch[]; refPrice: number | null; rangeKey?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Line"> | null>(null);
  const refLine = useRef<ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null>(null);
  const previous = useRef<{ rangeKey: string; times: number[] } | null>(null);

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
      lineWidth: 2,
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
      previous.current = null;
    };
  }, []);

  useEffect(() => {
    const s = series.current;
    const timeScale = chart.current?.timeScale();
    if (!s || !timeScale) return;
    const points = new Map<number, number>();
    for (const batch of batches) {
      const time = Math.floor(Date.parse(batch.t) / 1000);
      if (Number.isFinite(time) && batch.clearing_price !== null && Number.isFinite(batch.clearing_price)) points.set(time, batch.clearing_price);
    }
    const data = [...points].sort((a, b) => a[0] - b[0]).map(([time, value]) => ({ time: time as UTCTimestamp, value }));
    const currentTimes = data.map(point => Number(point.time));
    const old = previous.current;
    const visible = timeScale.getVisibleLogicalRange();
    const resetRange = !old || old.rangeKey !== rangeKey || old.times.length === 0;
    const followingLatest = !!visible && !!old?.times.length && visible.to >= old.times.length - 1;

    s.setData(data);
    if (data.length && (resetRange || !visible)) {
      timeScale.fitContent();
    } else if (data.length && visible && old) {
      if (followingLatest) {
        // Advance by new bars while retaining the trader's zoom and right margin.
        const delta = data.length - old.times.length;
        timeScale.setVisibleLogicalRange({ from: visible.from + delta, to: visible.to + delta });
      } else {
        // Rolling windows shift logical indices. Preserve the visible timestamp.
        const oldIndex = Math.max(0, Math.min(old.times.length - 1, Math.floor(visible.from)));
        const newIndex = currentTimes.indexOf(old.times[oldIndex]);
        const overlap = old.times.findIndex(time => currentTimes.includes(time));
        const delta = newIndex >= 0 ? newIndex - oldIndex : overlap >= 0 ? currentTimes.indexOf(old.times[overlap]) - overlap : 0;
        timeScale.setVisibleLogicalRange({ from: visible.from + delta, to: visible.to + delta });
      }
    }
    previous.current = { rangeKey, times: currentTimes };
  }, [batches, rangeKey]);

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
