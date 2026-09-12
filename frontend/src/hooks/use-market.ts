"use client";

import { useEffect, useRef, useState } from "react";
import type { Batch, Book } from "@contracts/types";
import { getBatches, getBook, subscribeMarket } from "@/lib/api";

/**
 * A batch auction shows one book per round. Orders arrive continuously, but the page only moves
 * when a round clears: the book you see is the sealed book of the round that just cleared, plus a
 * count of orders waiting in the round in progress. Between clears nothing on the page changes
 * except the clock.
 */
export interface MarketView {
  book: Book | null;
  /** live book (next round in progress); only the count is shown */
  pending: number;
  batches: Batch[];
  last: number | null;
  prev: number | null;
  round: number;
  tick: number;
  dir: "up" | "down" | null;
  changed: Set<string>;
  ready: boolean;
  /** true for 4s after a round clears: long enough to read who traded */
  justCleared: boolean;
}

const levelKey = (side: "b" | "a", price: number) => `${side}${price}`;

function diffLevels(prev: Book | null, next: Book): Set<string> {
  const out = new Set<string>();
  if (!prev) return out;
  const before = new Map<string, number>();
  for (const l of prev.bids) before.set(levelKey("b", l.price), l.qty);
  for (const l of prev.asks) before.set(levelKey("a", l.price), l.qty);
  for (const l of next.bids) if (before.get(levelKey("b", l.price)) !== l.qty) out.add(levelKey("b", l.price));
  for (const l of next.asks) if (before.get(levelKey("a", l.price)) !== l.qty) out.add(levelKey("a", l.price));
  return out;
}

const count = (b: Book | null) => b?.n_open_orders ?? 0;

export function useMarket(id: string, enabled = true): MarketView {
  const [book, setBook] = useState<Book | null>(null);
  const [pending, setPending] = useState(0);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tick, setTick] = useState(0);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [justCleared, setJustCleared] = useState(false);
  const live = useRef<Book | null>(null);
  const shownAt = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let flash: number | undefined;
    (async () => {
      const [b, h] = await Promise.all([getBook(id), getBatches(id, 120)]);
      if (!alive) return;
      live.current = b;
      shownAt.current = count(b);
      setBook(b);
      setPending(0);
      setBatches(h);
      setReady(true);
    })();
    const off = subscribeMarket(id, (f) => {
      if (!alive) return;
      if (f.type === "book") {
        // hold it: the book on screen changes only when the round clears
        live.current = f.book;
        setPending(Math.max(0, count(f.book) - shownAt.current));
        return;
      }
      if (f.type === "batch") {
        setBatches((xs) => [...xs.slice(-199), f.batch]);
        setTick((t) => t + 1);
        setJustCleared(true);
        window.clearTimeout(flash);
        flash = window.setTimeout(() => setJustCleared(false), 4000);
        // the book frame that follows a batch is the fresh round's opening book
        window.setTimeout(() => {
          const next = live.current;
          if (!next || !alive) return;
          setBook((old) => {
            setChanged(diffLevels(old, next));
            return next;
          });
          shownAt.current = count(next);
          setPending(0);
        }, 60);
      }
    });
    return () => {
      alive = false;
      window.clearTimeout(flash);
      off();
    };
  }, [id, enabled]);

  const priced = batches.filter((b) => b.clearing_price !== null);
  const last = priced.at(-1)?.clearing_price ?? book?.last ?? null;
  const prev = priced.length >= 2 ? priced[priced.length - 2].clearing_price ?? null : null;
  const dir = last !== null && prev !== null && last !== prev ? (last > prev ? "up" : "down") : null;
  const round: number = batches.at(-1)?.round ?? batches.length;
  return { book, pending, batches, last, prev, round, tick, dir, changed, ready, justCleared };
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
