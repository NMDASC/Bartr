"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentMessage } from "@contracts/types";
import { API_URL, IS_MOCK, demoUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import fixture from "@contracts/examples/agent-chat.json";

const canned = (fixture as { messages: AgentMessage[] }).messages;

async function ask(sessionId: string, message: string, history: AgentMessage[]): Promise<AgentMessage> {
  if (IS_MOCK) {
    await new Promise((r) => setTimeout(r, 700));
    // walk the fixture: reply with the next assistant turn, then fall back to a stub
    const idx = history.filter((m) => m.role === "assistant").length;
    const next = canned.filter((m) => m.role === "assistant")[idx];
    return next ?? { role: "assistant", content: "Mock agent out of lines. Set NEXT_PUBLIC_API_URL to talk to the real one." };
  }
  const res = await fetch(`${API_URL}/api/v1/agent/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-demo-user": demoUser() },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) throw new Error(`agent ${res.status}`);
  // contract: streamed text or a JSON AgentMessage; accept both
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as AgentMessage;
  return { role: "assistant", content: await res.text() };
}

export function Chat() {
  const [msgs, setMsgs] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const session = useRef<string>("");
  useEffect(() => {
    session.current = `web:${demoUser()}`;
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...msgs, { role: "user", content: t } as AgentMessage];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const reply = await ask(session.current, t, next);
      setMsgs((m) => [...m, reply]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Agent error" }]);
    } finally {
      setBusy(false);
    }
  }

  const starters = ["find me a laundromat in oklahoma under 1.2m", "buy 50 shares of suds city at 104", "what should i hold with 10k"];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px] pb-20">
      <div className="bg-card border border-line flex flex-col min-h-[520px]">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <Label>Session</Label>
          <span className="font-mono text-[10px] text-muted-foreground">{IS_MOCK ? "mock" : "live"}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {msgs.map((m, i) => (
            <div key={i} className={cn("max-w-[72ch]", m.role === "user" ? "self-end" : "self-start")}>
              <Label tracking="tight" className="block mb-1">{m.role === "user" ? "you" : "jb"}</Label>
              <div className={cn("px-3 py-2 text-[15px] whitespace-pre-wrap", m.role === "user" ? "bg-surface" : "border-l-2 border-accent bg-accent/[0.05]")}>{m.content}</div>
              {m.tool_calls?.length ? (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.tool_calls.map((t, j) => (
                    <li key={j} className="border border-tint-400/40 bg-tint-400/[0.08] px-2 py-0.5 font-mono text-[10px] text-tint-600">
                      {t.name}({Object.entries(t.args).map(([k, v]) => `${k}=${String(v)}`).join(", ")}) → {t.result_count}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          {busy ? <Label tracking="tight" className="animate-pulse">thinking</Label> : null}
          <div ref={end} />
        </div>
        <form
          className="flex gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="find me a car wash in texas" aria-label="Message" />
          <Button type="submit" variant="primary" disabled={busy || !input.trim()}>Send</Button>
        </form>
      </div>
      <aside className="flex flex-col gap-3">
        <Label>Try</Label>
        {starters.map((s) => (
          <button key={s} type="button" onClick={() => send(s)} className="text-left bg-surface hover:bg-surface-hover px-3 py-2.5 text-[14px] transition-colors duration-150 ease-out">
            {s}
          </button>
        ))}
      </aside>
    </div>
  );
}
