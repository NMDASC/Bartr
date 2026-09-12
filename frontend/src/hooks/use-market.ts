"use client";

import { useEffect, useState } from "react";
import type { Batch, Book } from "@contracts/types";
import { getBatches, getBook, subscribeMarket } from "@/lib/api";

export interface MarketView {
  book: Book | null;
  batches: Batch[];
  last: number | null;
  prev: number | null;
  /** Increments on every cleared batch so components can flash. */
  tick: number;
  ready: boolean;
}

export function useMarket(id: string, enabled = true): MarketView {
  const [book, setBook] = useState<Book | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      const [b, h] = await Promise.all([getBook(id), getBatches(id, 120)]);
      if (!alive) return;
      setBook(b);
      setBatches(h);
      setReady(true);
    })();
    const off = subscribeMarket(id, (f) => {
      if (!alive) return;
      if (f.type === "book") setBook(f.book);
      if (f.type === "batch") {
        setBatches((xs) => [...xs.slice(-199), f.batch]);
        setTick((t) => t + 1);
      }
    });
    return () => {
      alive = false;
      off();
    };
  }, [id, enabled]);

  const last = batches.at(-1)?.clearing_price ?? book?.last ?? null;
  const prev = batches.length >= 2 ? batches[batches.length - 2].clearing_price : null;
  return { book, batches, last, prev, tick, ready };
}

/** Seconds until an ISO time, ticking at 10 Hz. */
export function useCountdown(iso: string | null | undefined) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const target = Date.parse(iso);
    const t = window.setInterval(() => setS(Math.max(0, (target - Date.now()) / 1000)), 100);
    return () => window.clearInterval(t);
  }, [iso]);
  return s;
}
