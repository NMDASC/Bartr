import type { FieldEvidence } from "@contracts/types";
import { Label } from "@/components/ui/label";
import { usd } from "@/lib/format";

export function Evidence({ facts }: { facts: FieldEvidence[] }) {
  if (!facts.length) return null;
  return (
    <section aria-label="Company evidence" className="bg-card border border-line">
      <div className="border-b border-line px-3 py-2"><Label>Reported facts & estimates</Label></div>
      <ul className="divide-y divide-hairline">
        {facts.map((fact, index) => (
          <li key={`${fact.field}:${fact.source_url}:${index}`} className="p-3">
            <div className="flex flex-wrap justify-between gap-2 text-[14px]">
              <span className="capitalize">{fact.field.replaceAll("_", " ")}</span>
              <span className="font-mono tabular-nums">
                {fact.value === null ? "—" : typeof fact.value === "number" && fact.currency === "USD" ? usd(fact.value, { cents: false }) : String(fact.value)}
              </span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {fact.status === "reported" ? "Reported" : "Estimated"}{fact.period ? ` · ${fact.period}` : ""}
            </div>
            <blockquote className="mt-2 text-[13px] secondary">{fact.quote}</blockquote>
            {/^https?:\/\//i.test(fact.source_url) ? <a className="mt-1 inline-block text-[12px] text-accent-deep underline" href={fact.source_url} target="_blank" rel="noreferrer">Source</a> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
