"use client";

import type { FieldEvidence, Source, Valuation } from "@contracts/types";
import { Evidence } from "@/components/company/evidence";
import { Sources } from "@/components/company/sources";
import { Label } from "@/components/ui/label";
import { pct, usd } from "@/lib/format";

const METHOD_LABELS: Record<string, string> = {
  income: "Income",
  listing: "Listing",
  proxy: "Operating proxy",
  llm: "Grok and K2",
  base_rate: "Category base rate",
};

export function AppraisalDetails({
  valuation,
  evidence,
  sources,
  risks,
}: {
  valuation: Valuation | null;
  evidence: FieldEvidence[];
  sources: Source[];
  risks: string[];
}) {
  const totalPrecision =
    valuation?.estimates.reduce((sum, estimate) => sum + 1 / estimate.sigma ** 2, 0) ?? 0;

  return (
    <section id="appraisal-methodology" className="scroll-mt-6 border-y border-line py-8">
      <div className="mb-6">
        <Label className="mb-1 block">Appraisal</Label>
        <h2 className="text-[24px] md:text-[28px]">Evidence and calculation</h2>
      </div>

      {risks.length ? (
        <section
          aria-labelledby="red-flags-heading"
          className="mb-8 border border-down/30 bg-down/[0.04] p-4"
        >
          <div className="flex items-center gap-2">
            <span className="border border-down/30 bg-down/[0.08] px-2 py-0.5 font-mono text-[10px] text-down">
              {risks.length}
            </span>
            <h3 id="red-flags-heading" className="text-[17px]">
              Red flags and evidence gaps
            </h3>
          </div>
          <ul className="mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2">
            {risks.map((risk) => (
              <li key={risk} className="flex gap-2 text-[13px] leading-[1.45]">
                <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 bg-down" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {valuation ? (
        <>
          <section aria-labelledby="method-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <Label className="mb-1 block">How the estimate is combined</Label>
                <h3 id="method-heading" className="text-[20px]">
                  Four steps
                </h3>
              </div>
              <Label tracking="tight">{valuation.estimates.length} methods</Label>
            </div>

            <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["1", "Normalize", "Each method as a log value."],
                ["2", "Weight", "Tighter estimates count more."],
                ["3", "Combine", "Blend the methods, then add disagreement."],
                ["4", "Range", "A mid value plus a P20 to P80 band."],
              ].map(([step, title, body]) => (
                <div key={step} className="bg-card p-4">
                  <Label tracking="tight">{step}</Label>
                  <div className="mt-2 text-[15px]">{title}</div>
                  <p className="mt-1.5 text-[13px] leading-[1.5] text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-px bg-line md:grid-cols-4">
              {[
                ["Value", usd(valuation.v0, { compact: true })],
                ["Uncertainty", valuation.sigma.toFixed(3)],
                ["Disagreement", valuation.disagreement.toFixed(3)],
                ["Confidence", pct(Math.max(0, Math.min(1, 1 - valuation.sigma)), 0)],
              ].map(([label, value]) => (
                <div key={label} className="bg-card p-4">
                  <Label tracking="tight" className="mb-2 block">
                    {label}
                  </Label>
                  <div className="font-mono text-[20px] tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8" aria-labelledby="methods-heading">
            <h3 id="methods-heading" className="text-[20px]">
              Inputs
            </h3>
            <ol className="mt-3 divide-y divide-line border-y border-line">
              {valuation.estimates.map((estimate) => {
                const weight =
                  totalPrecision > 0 ? 1 / estimate.sigma ** 2 / totalPrecision : 0;
                return (
                  <li
                    key={estimate.name}
                    className="grid gap-3 py-4 md:grid-cols-[150px_120px_100px_1fr] md:items-start"
                  >
                    <div>
                      <Label tracking="tight">Method</Label>
                      <div className="mt-1 text-[14px]">
                        {METHOD_LABELS[estimate.name] ?? estimate.name.replaceAll("_", " ")}
                      </div>
                    </div>
                    <div>
                      <Label tracking="tight">Estimate</Label>
                      <div className="mt-1 font-mono text-[14px] tabular-nums">
                        {usd(estimate.value, { compact: true })}
                      </div>
                    </div>
                    <div>
                      <Label tracking="tight">Weight</Label>
                      <div className="mt-1 font-mono text-[14px] tabular-nums">{pct(weight, 0)}</div>
                    </div>
                    <div>
                      <Label tracking="tight">Basis</Label>
                      <p className="mt-1 text-[13px] leading-[1.5] text-muted-foreground [overflow-wrap:anywhere]">{estimate.note}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      ) : (
        <p className="text-[14px] text-muted-foreground">A completed appraisal is not available yet.</p>
      )}

      <div className="mt-8 grid min-w-0 gap-4 lg:grid-cols-2">
        <Evidence facts={evidence} />
        <Sources sources={sources} />
      </div>
    </section>
  );
}
