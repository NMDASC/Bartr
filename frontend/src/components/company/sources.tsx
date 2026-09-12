import type { Source } from "@contracts/types";
import { domain } from "@/lib/format";
import { Label } from "@/components/ui/label";

export function Sources({ sources }: { sources: Source[] }) {
  return (
    <div className="bg-card border border-line">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <Label>Sources</Label>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{sources.length}</span>
      </div>
      {sources.length === 0 ? (
        <p className="p-3 text-[14px] secondary">No sources yet.</p>
      ) : (
        <ol className="divide-y divide-hairline">
          {sources.map((s, i) => (
            <li key={s.url} className="p-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-tint-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-[14px] text-accent-deep underline underline-offset-[0.15em] decoration-accent-deep/40 hover:decoration-accent-deep">
                  {s.title}
                </a>
              </div>
              <div className="mt-0.5 pl-6 font-mono text-[10px] text-muted-foreground">{domain(s.url)}</div>
              <p className="mt-1 pl-6 text-[13px] secondary">{s.snippet}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
