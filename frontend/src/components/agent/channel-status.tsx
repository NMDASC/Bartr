"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChannelStatus } from "@contracts/types";
import { API_URL, IS_MOCK, demoUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { displayPhone } from "@/lib/auth/account";

/**
 * Two numbers, and they are not the same thing: the line you text, and the
 * number you text from. The second one is the account identity, because the
 * bridge can only report a sender's number, so pairing it is what makes a
 * texted order land on this account instead of a second one.
 *
 * `connected` is the API's own reading (a bridge heartbeat inside the last
 * 120s), never this component's guess, so a dead bridge reads offline rather
 * than optimistic. Poll is shorter than that window, so the chip turns over
 * within one interval of the line dropping.
 */
const POLL_MS = 15_000;

function age(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const OFFLINE: ChannelStatus = {
  configured: false,
  connected: false,
  phone_number: null,
  last_seen: null,
  identity: "",
  identity_kind: "name",
};

export function ChannelStatusBar({
  className,
  userId,
  pairedPhone,
}: {
  className?: string;
  userId?: string;
  pairedPhone?: string | null;
}) {
  const [status, setStatus] = useState<ChannelStatus>(OFFLINE);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (IS_MOCK) return;
    let alive = true;
    const read = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/agent/channel`, {
          headers: { "x-demo-user": userId || demoUser() },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as ChannelStatus;
        if (alive) setStatus(next);
      } catch {
        // An unreachable API is an offline line, not an error to render.
        if (alive) setStatus(OFFLINE);
      }
    };
    // Deferred rather than called in the effect body, so the first read is a
    // callback into an external system and not a synchronous cascading render.
    const first = setTimeout(() => void read(), 0);
    const poll = setInterval(read, POLL_MS);
    const tick = setInterval(() => alive && setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [userId]);

  const copy = useCallback(async () => {
    if (!status.phone_number) return;
    try {
      await navigator.clipboard.writeText(status.phone_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [status.phone_number]);

  async function pair(value: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: value }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not pair that number.");
      }
      // The identity is read server side on this route, so re-render from the server.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pair that number.");
      setBusy(false);
    }
  }

  const live = status.connected;
  const seen = age(status.last_seen, now);

  return (
    <div className={cn("border-t border-line", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 py-4">
        <div className="flex items-baseline gap-3">
          <Label>iMessage</Label>
          {status.phone_number ? (
            <button
              type="button"
              onClick={copy}
              aria-label={`Copy ${displayPhone(status.phone_number)}`}
              className="font-mono text-[15px] tabular-nums transition-colors duration-150 ease-out hover:text-accent"
            >
              {displayPhone(status.phone_number)}
            </button>
          ) : (
            <span className="font-mono text-[15px] text-tint-500">&mdash;</span>
          )}
          {copied ? <Label tracking="tight" className="text-accent">copied</Label> : null}
        </div>

        <div className="flex items-baseline gap-4">
          {seen ? (
            <div className="flex items-baseline gap-2">
              <Label tracking="tight">last seen</Label>
              <span className="font-mono text-[11px] tabular-nums text-tint-600">{seen}</span>
            </div>
          ) : null}
          <Chip tone={live ? "accent" : "neutral"}>{live ? "Live" : "Offline"}</Chip>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-line py-4">
        <div className="flex items-baseline gap-3">
          <Label>your number</Label>
          {pairedPhone ? (
            <span className="font-mono text-[15px] tabular-nums">{displayPhone(pairedPhone)}</span>
          ) : (
            <span className="font-mono text-[15px] text-tint-500">&mdash;</span>
          )}
        </div>

        {pairedPhone ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void pair("")}>
            Unpair
          </Button>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) void pair(draft);
            }}
          >
            {error ? (
              <span role="alert" className="font-mono text-[11px] text-down">
                {error}
              </span>
            ) : null}
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 (412) 475-4173"
              aria-label="Your iMessage number"
              className="w-[190px]"
            />
            <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
              Pair
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
