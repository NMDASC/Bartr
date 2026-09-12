"use client";

import { useState } from "react";
import type { ChecklistItem } from "@contracts/types";
import { domain } from "@/lib/format";
import { Label } from "@/components/ui/label";

export function Checklist({ items }: { items: ChecklistItem[] }) {
  const [done, setDone] = useState<boolean[]>(items.map((i) => i.done));
  const n = done.filter(Boolean).length;
  return (
    <aside className="bg-card border border-line self-start">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <Label>Diligence checklist</Label>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{n}/{items.length}</span>
      </div>
      <div className="h-px bg-tint-300">
        <div className="h-px bg-accent transition-[width] duration-300 ease-out" style={{ width: `${(n / Math.max(1, items.length)) * 100}%` }} />
      </div>
      <ol className="divide-y divide-hairline">
        {items.map((it, i) => (
          <li key={i} className="p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={done[i]}
                onChange={(e) => setDone((d) => d.map((x, j) => (j === i ? e.target.checked : x)))}
                className="mt-1 size-4 shrink-0 appearance-none border border-line bg-input checked:bg-primary checked:border-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              />
              <span className="flex-1">
                <span className={done[i] ? "text-[15px] line-through decoration-tint-400 text-muted-foreground" : "text-[15px]"}>{it.item}</span>
                <span className="mt-1 block text-[13px] secondary">{it.why}</span>
                {it.citation ? (
                  <a href={it.citation.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-block font-mono text-[10px] text-accent-deep underline underline-offset-[0.15em] decoration-accent-deep/40 hover:decoration-accent-deep">
                    {domain(it.citation.url)}
                  </a>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ol>
    </aside>
  );
}
