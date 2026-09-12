import Link from "next/link";
import { getFlags } from "@/lib/api";
import { clock } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import type { Severity } from "@contracts/types";

export const dynamic = "force-dynamic";

const tone = (s: Severity): "down" | "accent" | "neutral" => (s === "high" ? "down" : s === "medium" ? "accent" : "neutral");

export default async function SurveillancePage() {
  const flags = await getFlags();
  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="pt-10 pb-6">
        <Label className="mb-3 block">Surveillance</Label>
        <h1 className="text-[30px] md:text-[40px] leading-[1.1]">Every batch, reviewed twice.</h1>
        <p className="mt-subhead text-[16px] secondary max-w-2xl">
          Deterministic detectors run on the tape after each round. Grok writes the case. K2 Horizon reviews it independently. Disagreement is shown, not hidden.
        </p>
      </div>

      <div className="grid grid-cols-3 border-t border-b border-line divide-x divide-line">
        {[
          ["Flags", flags.length],
          ["High", flags.filter((f) => f.severity === "high").length],
          ["Disputed", flags.filter((f) => f.disputed).length],
        ].map(([k, v]) => (
          <div key={String(k)} className="px-4 py-4">
            <Label tracking="tight" className="block mb-1">{k}</Label>
            <div className="text-[24px] leading-none tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <ol className="py-6 pb-20 flex flex-col">
        {flags.map((f) => (
          <li key={f._id} className="border-b border-hairline py-5 grid gap-3 md:grid-cols-[180px_1fr]">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] tabular-nums text-tint-400">{f._id.toUpperCase()}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{clock(f.t)}</span>
              <Link href={`/company/${f.market_id}`} className="font-mono text-[11px] text-accent-deep underline underline-offset-[0.15em] decoration-accent-deep/40">
                {f.market_id}
              </Link>
              <span className="font-mono text-[11px] text-muted-foreground">{f.batch_id}</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={tone(f.severity)}>{f.rule.replace(/_/g, " ")}</Chip>
                <Chip tone={tone(f.severity)}>{f.severity}</Chip>
                {f.disputed ? <Chip tone="accent">disputed</Chip> : null}
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground ml-1">{f.subjects.join(", ")}</span>
              </div>
              <p className="mt-3 text-[16px] max-w-[72ch]">{f.explanation}</p>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px]">
                {f.reviews.map((r) => (
                  <div key={r.reviewer} className="flex gap-2">
                    <dt className="uppercase tracking-[0.08em] text-muted-foreground">{r.reviewer}</dt>
                    <dd className={r.severity === "high" ? "text-down" : r.severity === "medium" ? "text-accent" : "text-foreground"}>{r.severity}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
