"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import "./landing.css";

const ROTATION = [
  "laundromat in Pittsburgh under 1.2M",
  "car wash on McKnight Road",
  "machine shop in McKees Rocks",
  "family restaurant on the South Side",
];

const TYPE_MS = 42;
const DELETE_MS = 22;
const HOLD_MS = 1900;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The one input the whole demo starts from, so it carries the most motion:
 * the ghost query types and retypes itself while the field is untouched, the
 * accent rule draws out from the left edge on focus, and a chip writes itself
 * into the field before the page moves.
 */
export function SearchBar({
  initial = "",
  className,
  autoFocus,
  chips,
}: {
  initial?: string;
  className?: string;
  autoFocus?: boolean;
  chips?: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [ghost, setGhost] = useState("");
  const [idle, setIdle] = useState(initial === "");
  const hostRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<number | null>(null);

  useEffect(() => {
    if (!idle) return;
    if (reducedMotion()) {
      setGhost(ROTATION[0]);
      return;
    }
    let cancelled = false;
    let phrase = 0;
    let char = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      if (cancelled) return;
      const target = ROTATION[phrase];
      if (!deleting) {
        char += 1;
        setGhost(target.slice(0, char));
        if (char === target.length) {
          deleting = true;
          timer = setTimeout(step, HOLD_MS);
          return;
        }
        timer = setTimeout(step, TYPE_MS);
      } else {
        char -= 1;
        setGhost(target.slice(0, char));
        if (char === 0) {
          deleting = false;
          phrase = (phrase + 1) % ROTATION.length;
        }
        timer = setTimeout(step, char === 0 ? 320 : DELETE_MS);
      }
    };
    timer = setTimeout(step, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idle]);

  useEffect(() => () => void (fillRef.current && window.clearInterval(fillRef.current)), []);

  const go = useCallback((text: string) => router.push(`/search?q=${encodeURIComponent(text)}`), [router]);

  /** A chip writes into the field at speed, then searches. */
  const fill = useCallback(
    (text: string) => {
      if (fillRef.current) window.clearInterval(fillRef.current);
      setIdle(false);
      hostRef.current?.querySelector("input")?.focus();
      if (reducedMotion()) {
        setQ(text);
        go(text);
        return;
      }
      let i = 0;
      const stride = Math.max(1, Math.round(text.length / 16));
      fillRef.current = window.setInterval(() => {
        i += stride;
        setQ(text.slice(0, Math.min(i, text.length)));
        if (i >= text.length) {
          if (fillRef.current) window.clearInterval(fillRef.current);
          fillRef.current = null;
          window.setTimeout(() => go(text), 240);
        }
      }, 18);
    },
    [go],
  );

  return (
    <div ref={hostRef} className={className}>
      <form
        role="search"
        className="bl-field relative flex items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go(q.trim());
        }}
      >
        <label htmlFor="q" className="sr-only">
          Describe the business you want
        </label>
        <div className="relative flex-1">
          <Input
            id="q"
            name="q"
            value={q}
            autoFocus={autoFocus}
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setIdle(false);
            }}
            onFocus={() => setIdle(false)}
            onBlur={() => setIdle(q === "")}
            className="h-11 w-full text-[16px]"
          />
          {q === "" ? (
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[16px] text-foreground/45">
              {ghost}
              {idle ? <span className="bl-caret ml-px" /> : null}
            </span>
          ) : null}
          <span aria-hidden className="bl-underline pointer-events-none absolute inset-x-0 bottom-0 h-px bg-accent" />
        </div>
        <Button type="submit" variant="primary" size="lg" className="h-11 shrink-0">
          Search
        </Button>
      </form>

      {chips?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <Button key={c} size="sm" onClick={() => fill(c)}>
              {c}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
