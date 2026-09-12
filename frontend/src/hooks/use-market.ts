"use client";

import { useEffect, useRef, useState } from "react";
import type { Batch, Book } from "@contracts/types";
import { getBatches, getBook, subscribeMarket } from "@/lib/api";

/**
 * A batch auction shows one book per round. Orders arrive continuously, but the page only moves
 * when a round ends: the levels you see are the resting book at the last round boundary, plus a
 * count of orders that have come in since. A boundary is detected from `next_batch_at` moving
 * forward on any book frame, so quiet rounds (no trade) advance the clock like any other.
 */
export interface MarketView {
  book: Book | null;
  /** orders that arrived since the round boundary (not yet shown in the book) */
  pending: number;
  batches: Batch[];
  last: number | null;
  prev: number | null;
  /** 1-based number of the round in progress */
  round: number;
  tick: number;
  dir: "up" | "down" | null;
  changed: Set<string>;
  ready: boolean;
  /** true for 4s after a round clears: long enough to read who traded */
  justCleared: boolean;
  /** true for 1s after a clear: the number flash, without hijacking the countdown */
  flash: boolean;
  /** the last round boundary passed with no trade */
  quietRound: boolean;
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
const at = (b: Book | null) => (b?.next_batch_at ? Date.parse(b.next_batch_at) : 0);

export function useMarket(id: string, enabled = true): MarketView {
  const [book, setBook] = useState<Book | null>(null);
  const [pending, setPending] = useState(0);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tick, setTick] = useState(0);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [justCleared, setJustCleared] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [quietRound, setQuietRound] = useState(false);
  const [roundsSeen, setRoundsSeen] = useState(0);
  const lastBatchAt = useRef<number>(0);
  const held = useRef<Book | null>(null);
  const you = useRef<string | null>(null);
  const shownAt = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let flash: number | undefined;
    let flash2: number | undefined;
    const adopt = (b: Book) => {
      const next = { ...b, you: you.current };
      setBook((old) => {
        setChanged(diffLevels(old, next));
        return next;
      });
      held.current = next;
      shownAt.current = count(next);
      setPending(0);
    };
    (async () => {
      const [b, h] = await Promise.all([getBook(id), getBatches(id, 120)]);
      if (!alive) return;
      you.current = b.you ?? null;
      adopt(b);
      setBatches(h);
      setRoundsSeen(h.at(-1)?.round ?? h.length);
      setReady(true);
    })();
    const off = subscribeMarket(id, (f) => {
      if (!alive) return;
      if (f.type === "book") {
        if (at(f.book) > at(held.current)) {
          // the round boundary passed (with or without a trade): show the new resting book
          adopt(f.book);
          setRoundsSeen((r) => r + 1);
          setQuietRound(Date.now() - lastBatchAt.current > 1500);
        } else {
          setPending(Math.max(0, count(f.book) - shownAt.current));
        }
        return;
      }
      if (f.type === "batch") {
        lastBatchAt.current = Date.now();
        setQuietRound(false);
        setBatches((xs) => [...xs.slice(-199), f.batch]);
        setTick((t) => t + 1);
        setJustCleared(true);
        setFlashOn(true);
        window.clearTimeout(flash);
        window.clearTimeout(flash2);
        flash = window.setTimeout(() => setJustCleared(false), 4000);
        flash2 = window.setTimeout(() => setFlashOn(false), 1000);
      }
    });
    return () => {
      alive = false;
      window.clearTimeout(flash);
      window.clearTimeout(flash2);
      off();
    };
  }, [id, enabled]);

  const priced = batches.filter((b) => b.clearing_price !== null);
  const last = priced.at(-1)?.clearing_price ?? book?.last ?? null;
  const prev = priced.length >= 2 ? priced[priced.length - 2].clearing_price ?? null : null;
  const dir = last !== null && prev !== null && last !== prev ? (last > prev ? "up" : "down") : null;
  const round = Math.max(roundsSeen, batches.at(-1)?.round ?? 0) + 1;
  return { book, pending, batches, last, prev, round, tick, dir, changed, ready, justCleared, flash: flashOn, quietRound };
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
