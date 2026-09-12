"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChannelStatus } from "@contracts/types";
import { API_URL, IS_MOCK, demoUser } from "@/lib/api";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

/**
 * The same conversation over a phone line. `connected` is the API's own reading
 * (a bridge heartbeat inside the last 120s), never this component's guess, so a
 * dead bridge reads offline rather than optimistic.
 *
 * Poll is shorter than the API's 120s window, so the chip turns over within one
 * interval of the line dropping.
 */
const POLL_MS = 15_000;

/** +16282894567 -> +1 (628) 289-4567. Leaves anything it cannot parse alone. */
function formatE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return raw;
  return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

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

export function ChannelStatusBar({ className }: { className?: string }) {
  const [status, setStatus] = useState<ChannelStatus>(OFFLINE);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (IS_MOCK) return;
    let alive = true;
    const read = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/agent/channel`, {
          headers: { "x-demo-user": demoUser() },
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
    void read();
    const poll = setInterval(read, POLL_MS);
    const tick = setInterval(() => alive && setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

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
              aria-label={`Copy ${formatE164(status.phone_number)}`}
              className="font-mono text-[15px] tabular-nums transition-colors duration-150 ease-out hover:text-accent"
            >
              {formatE164(status.phone_number)}
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
    </div>
  );
}
