"use client";

import { useEffect, useRef, useState } from "react";
import type { Batch, Book, Side } from "@contracts/types";
import type { Order } from "@contracts/types";
import { getBatches, getBook, getMyOrders, subscribeMarket } from "@/lib/api";

export type MarketArrival = {
  id: string;
  uid_hash: string;
  alias: string;
  side: Side;
  qty: number;
  price: number | null;
};

export interface MarketView {
  book: Book | null;
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
  justCleared: boolean;
  flash: boolean;
  quietRound: boolean;
  arrivals: MarketArrival[];
  mine: Order[];
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

function inferPrice(prev: Book, next: Book, side: Side) {
  const before = side === "buy" ? prev.bids : prev.asks;
  const after = side === "buy" ? next.bids : next.asks;
  const prior = new Map(before.map((l) => [l.price, l.qty]));
  let best: { price: number; delta: number } | null = null;
  for (const l of after) {
    const delta = l.qty - (prior.get(l.price) ?? 0);
    if (delta > 0 && (!best || delta > best.delta)) best = { price: l.price, delta };
  }
  return best?.price ?? null;
}

function detectArrivals(prev: Book | null, next: Book): MarketArrival[] {
  if (!prev) return [];
  const before = new Map((prev.participants ?? []).map((p) => [`${p.uid_hash}:${p.side}`, p]));
  const out: MarketArrival[] = [];
  for (const p of next.participants ?? []) {
    const old = before.get(`${p.uid_hash}:${p.side}`);
    if (old && p.qty <= old.qty) continue;
    out.push({
      id: `${p.uid_hash}-${p.side}-${next.n_open_orders ?? 0}-${p.qty}`,
      uid_hash: p.uid_hash,
      alias: p.alias,
      side: p.side,
      qty: old ? p.qty - old.qty : p.qty,
      price: inferPrice(prev, next, p.side),
    });
  }
  return out;
}

const count = (b: Book | null) => b?.n_open_orders ?? 0;
const at = (b: Book | null) => (b?.next_batch_at ? Date.parse(b.next_batch_at) : 0);

export function useMarket(id: string, enabled = true, fresh = false): MarketView {
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
  const [arrivals, setArrivals] = useState<MarketArrival[]>([]);
  const [mine, setMine] = useState<Order[]>([]);
  const lastBatchAt = useRef<number>(0);
  const arrivalQueue = useRef<MarketArrival[]>([]);
  const boundaryAt = useRef<number>(0);
  const shownAt = useRef<number>(0);
  const you = useRef<string | null>(null);
  const live = useRef<Book | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let flash: number | undefined;
    let flash2: number | undefined;
    let retry: number | undefined;
    let attempts = 0;
    const adopt = (b: Book, history: boolean) => {
      const next = { ...b, you: you.current };
      setBook((old) => {
        if (!history) {
          const incoming = detectArrivals(old, next);
          if (incoming.length) arrivalQueue.current.push(...incoming);
        }
        setChanged(diffLevels(old, next));
        return next;
      });
      live.current = next;
      if (history || at(next) > boundaryAt.current) {
        boundaryAt.current = at(next);
        shownAt.current = count(next);
        setPending(0);
      } else {
        setPending(Math.max(0, count(next) - shownAt.current));
      }
    };
    const loadSnapshot = async () => {
      attempts += 1;
      const [bookResult, batchesResult] = await Promise.allSettled([
        getBook(id),
        getBatches(id, 120),
      ]);
      if (!alive) return;

      if (bookResult.status === "fulfilled") {
        you.current = bookResult.value.you ?? null;
        adopt(bookResult.value, true);
        setReady(true);
        getMyOrders(id)
          .then((rows) => {
            if (alive) setMine(rows.filter((o) => o.status === "open" || o.status === "partial"));
          })
          .catch(() => undefined);
      }
      if (batchesResult.status === "fulfilled" && !fresh) {
        const history = batchesResult.value;
        setBatches(history);
        setRoundsSeen(history.at(-1)?.round ?? history.length);
      }

      if (
        attempts < 3 &&
        (bookResult.status === "rejected" || batchesResult.status === "rejected")
      ) {
        retry = window.setTimeout(loadSnapshot, 750);
      }
    };
    void loadSnapshot();
    const off = subscribeMarket(id, (f) => {
      if (!alive) return;
      if (f.type === "book") {
        const crossed = at(f.book) > boundaryAt.current;
        adopt(f.book, false);
        if (crossed) {
          setRoundsSeen((r) => r + 1);
          setQuietRound(Date.now() - lastBatchAt.current > 1500);
        }
        getMyOrders(id).then((rows) => {
          if (alive) setMine(rows.filter((o) => o.status === "open" || o.status === "partial"));
        }).catch(() => undefined);
        return;
      }
      if (f.type === "batch") {
        lastBatchAt.current = Date.now();
        setQuietRound(false);
        setBatches((xs) => [...xs.slice(-199), f.batch]);
        setTick((t) => t + 1);
        setJustCleared(true);
        setFlashOn(false);
        window.clearTimeout(flash);
        window.clearTimeout(flash2);
        flash = window.setTimeout(() => setFlashOn(true), 1400);
        flash2 = window.setTimeout(() => {
          setJustCleared(false);
          setFlashOn(false);
        }, 4200);
      }
    });
    const drip = window.setInterval(() => {
      const next = arrivalQueue.current.shift();
      if (!next || !alive) return;
      setArrivals((xs) => [next, ...xs].slice(0, 4));
    }, 420);
    return () => {
      alive = false;
      window.clearTimeout(flash);
      window.clearTimeout(flash2);
      window.clearTimeout(retry);
      window.clearInterval(drip);
      off();
    };
  }, [id, enabled, fresh]);

  const priced = batches.filter((b) => b.clearing_price !== null);
  const last = priced.at(-1)?.clearing_price ?? (fresh ? null : book?.last ?? null);
  const prev = priced.length >= 2 ? priced[priced.length - 2].clearing_price ?? null : null;
  const dir = last !== null && prev !== null && last !== prev ? (last > prev ? "up" : "down") : null;
  const round = Math.max(roundsSeen, batches.length) + 1;
  return { book, pending, batches, last, prev, round, tick, dir, changed, ready, justCleared, flash: flashOn, quietRound, arrivals, mine };
}

/** Seconds until an ISO time, ticking at 10 Hz. Null until a target exists. */
export function useCountdown(iso: string | null | undefined) {
  const [s, setS] = useState<number | null>(iso ? Math.max(0, (Date.parse(iso) - Date.now()) / 1000) : null);
  useEffect(() => {
    if (!iso) {
      setS(null);
      return;
    }
    const target = Date.parse(iso);
    const tick = () => setS(Math.max(0, (target - Date.now()) / 1000));
    tick();
    const t = window.setInterval(tick, 100);
    return () => window.clearInterval(t);
  }, [iso]);
  return s;
}
