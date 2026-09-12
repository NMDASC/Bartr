import type { Company, FieldEvidence } from "@contracts/types";
import { AppraisalDetails } from "@/components/company/appraisal-details";
import { AppraisalStatus } from "@/components/company/appraisal-status";
import { BackLink } from "@/components/site/back-link";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { pct, usd } from "@/lib/format";

const TONE_RULE = {
  down: "border-l-down bg-down/[0.05]",
  up: "border-l-up bg-up/[0.06]",
  accent: "border-l-accent bg-accent/[0.05]",
} as const;

type CompanyObservables = {
  asking_price?: number | null;
  llm_confidence?: number | null;
  machines?: number | null;
  owner_operated?: boolean | null;
  years_operating?: number | null;
};

type DetailedCompany = Company & {
  observables?: CompanyObservables;
};

function readable(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function appraisalConfidence(company: Company) {
  if (company.financials) return company.financials.confidence;
  if (company.valuation) return Math.max(0, Math.min(1, 1 - company.valuation.sigma));
  return null;
}

function grokConfidence(company: DetailedCompany) {
  if (company.observables?.llm_confidence != null) {
    return company.observables.llm_confidence;
  }
  const note = company.valuation?.estimates.find((estimate) => estimate.name === "llm")?.note;
  const match = note?.match(/\bconf(?:idence)?\s*[:=]?\s*(0(?:\.\d+)?|1(?:\.0+)?)\b/i);
  return match ? Number(match[1]) : null;
}

function fundingFact(evidence: FieldEvidence[]) {
  return evidence.find((fact) =>
    /\b(funding|funded|capital_raised|investment|raised)\b/i.test(fact.field),
  );
}

function factValue(fact: FieldEvidence | undefined) {
  if (!fact || fact.value === null) return "Not found";
  if (typeof fact.value === "number" && fact.currency === "USD") {
    return usd(fact.value, { cents: false });
  }
  return String(fact.value);
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function redFlags(company: DetailedCompany) {
  const valuation = company.valuation;
  const financials = company.financials;
  const confidence = appraisalConfidence(company);
  const aiConfidence = grokConfidence(company);
  const flags = [...(valuation?.warnings ?? [])];
  const missing: string[] = [];

  if (company.status !== "ready" || !valuation) {
    flags.push("The appraisal is not complete.");
  }
  if (confidence !== null && confidence < 0.5) {
    flags.push("The combined valuation has low confidence because evidence is limited.");
  }
  if (aiConfidence !== null && aiConfidence < 0.4) {
    flags.push(`Grok assigned ${pct(aiConfidence)} confidence to its direct appraisal.`);
  }
  if (valuation && valuation.disagreement >= 0.35) {
    flags.push("The valuation methods disagree materially.");
  }
  if (!financials?.revenue_est && !financials?.sde_est) {
    missing.push("verified revenue or owner earnings");
  }
  if (!company.owners.length) {
    missing.push("confirmed ownership");
  }
  if (company.sources.length < 2) {
    missing.push("source corroboration");
  }
  if (missing.length) {
    flags.push(`Missing evidence: ${missing.join(", ")}.`);
  }

  return unique(flags);
}

function greenFlags(company: DetailedCompany) {
  const valuation = company.valuation;
  const financials = company.financials;
  const confidence = appraisalConfidence(company);
  const flags: string[] = [];
  const currentYear = new Date().getUTCFullYear();

  if (company.rating !== null && company.rating >= 4.5 && company.review_count >= 50) {
    flags.push(
      `${company.rating.toFixed(1)} rating across ${company.review_count.toLocaleString("en-US")} reviews.`,
    );
  }
  if (company.founded_year && currentYear - company.founded_year >= 10) {
    flags.push(`${currentYear - company.founded_year} years of operating history.`);
  }
  if (
    financials?.method === "extracted" &&
    (financials.revenue_est !== null || financials.sde_est !== null)
  ) {
    flags.push("Reported financial evidence supports the appraisal.");
  }
  if (confidence !== null && confidence >= 0.65) {
    flags.push(`Combined appraisal confidence is ${pct(confidence)}.`);
  }
  if (valuation && valuation.disagreement < 0.2 && valuation.estimates.length > 1) {
    flags.push("The valuation methods are closely aligned.");
  }
  if (company.sources.length >= 3) {
    flags.push(`${company.sources.length} source documents were reviewed.`);
  }
  if ((company.market?.belief?.n_rounds ?? 0) > 0) {
    flags.push(
      `${company.market?.belief?.n_rounds} completed market rounds provide price evidence.`,
    );
  }

  return flags;
}

function joinList(items: string[]) {
  if (items.length < 2) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function acquisitionRecommendation(
  company: DetailedCompany,
  confidence: number | null,
): { decision: string; detail: string; tone: "down" | "up" | "accent" } {
  const valuation = company.valuation;
  if (!valuation || confidence === null) {
    return {
      decision: "Wait for the appraisal",
      detail:
        "No acquisition value has been established. Complete the company research before setting a bid.",
      tone: "down",
    };
  }

  const missing: string[] = [];
  if (!company.financials?.revenue_est && !company.financials?.sde_est) {
    missing.push("verified earnings");
  }
  if (!company.owners.length) missing.push("confirmed ownership");
  if (company.sources.length < 2) missing.push("source corroboration");

  if (confidence < 0.5) {
    return {
      decision: "More diligence required",
      detail: `The valuation has ${pct(confidence)} confidence${
        missing.length ? ` and lacks ${joinList(missing)}` : ""
      }. Complete diligence before setting an acquisition price.`,
      tone: "down",
    };
  }

  if (valuation.disagreement >= 0.35) {
    return {
      decision: "Proceed cautiously",
      detail: `The valuation methods disagree materially${
        missing.length ? ` and still need ${joinList(missing)}` : ""
      }. Resolve the appraisal range before submitting a bid.`,
      tone: "accent",
    };
  }

  if (confidence >= 0.65 && missing.length === 0) {
    const financialBasis =
      company.financials?.method === "extracted" ? "reported financials" : "modeled financials";
    return {
      decision: "Advance to acquisition diligence",
      detail: `The appraisal has ${pct(
        confidence,
      )} confidence with ${financialBasis}, confirmed ownership, and source support. Compare any bid with the ${usd(
        valuation.low,
        { compact: true },
      )} to ${usd(valuation.high, { compact: true })} valuation range.`,
      tone: "up",
    };
  }

  return {
    decision: "Diligence before bidding",
    detail: `The appraisal has ${pct(confidence)} confidence${
      missing.length ? ` and still needs ${joinList(missing)}` : ""
    }. Validate those inputs before choosing an acquisition price.`,
    tone: "accent",
  };
}

export function CompanyOverview({ company }: { company: DetailedCompany }) {
  const valuation = company.valuation;
  const financials = company.financials;
  const confidence = appraisalConfidence(company);
  const recommendation = acquisitionRecommendation(company, confidence);
  const risks = redFlags(company);
  const strengths = greenFlags(company);
  const needsGrok =
    company.status === "ready" &&
    !!valuation &&
    !valuation.estimates.some((estimate) => estimate.name === "llm");
  const funding = fundingFact(company.evidence ?? []);
  const place = [company.city, company.state].filter(Boolean).join(", ");
  const category = readable(company.category);
  const ownerRetained =
    company.market && company.market.shares_outstanding > 0
      ? company.market.retained / company.market.shares_outstanding
      : null;
  const overview =
    company.description ||
    `${company.name} is a ${category.toLowerCase()} business${
      place ? ` based in ${place}` : ""
    }. Detailed operating information has not yet been confirmed.`;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 xl:border-x xl:border-line 3xl:max-w-8xl">
      <header className="pb-7 pt-8">
        <BackLink fallback="/search?q=laundromat%20in%20Pittsburgh" />
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Label>
                {category}
                {place ? ` · ${place}` : ""}
              </Label>
              {company.status === "ready" ? (
                <Chip tone="up">Appraised</Chip>
              ) : (
                <Chip tone="accent">Researching</Chip>
              )}
              <Chip tone={company.listed ? "accent" : "neutral"}>
                {company.listed ? "On exchange" : "Private"}
              </Chip>
            </div>
            <h1 className="mt-3 max-w-4xl text-[34px] leading-[1.04] md:text-[48px] 3xl:text-[56px]">
              {company.name}
            </h1>
          </div>

          <div className="flex flex-col gap-2 lg:min-w-64">
            <Label tracking="tight">
              {company.listed ? "Market live" : "Owner outreach"}
            </Label>
            <Button
              href={`/company/${company._id}/bid`}
              variant="positive"
              size="lg"
              className="w-full"
            >
              Bid for acquisition
            </Button>
          </div>
        </div>
      </header>

      <AppraisalStatus companyId={company._id} needed={needsGrok} />

      <section className={cn("border-t border-l-4 border-line px-4 py-5", TONE_RULE[recommendation.tone])}>
        <Label>AI-assisted acquisition recommendation</Label>
        <h2 className="mt-1.5 text-[24px] leading-[1.15] md:text-[28px]">{recommendation.decision}</h2>
        <p className="mt-2 max-w-4xl text-[15px] leading-[1.5] text-foreground/80">
          {recommendation.detail}
        </p>
      </section>

      <section
        aria-label="Appraisal summary"
        className="grid border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line"
      >
        <div className="border-b border-line p-4 sm:border-b-0">
          <Label tracking="tight" className="mb-2 block">
            Estimated value
          </Label>
          <div className="text-[34px] leading-none tabular-nums tracking-[-0.01em] md:text-[40px]">
            {usd(valuation?.v0, { compact: true })}
          </div>
        </div>
        <div className="border-b border-line p-4 sm:border-b-0">
          <Label tracking="tight" className="mb-2 block">
            Confidence
          </Label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-[19px] tabular-nums">
              <span
                aria-hidden
                className={`size-2.5 ${
                  confidence === null
                    ? "bg-tint-400"
                    : confidence >= 0.65
                      ? "bg-up"
                      : "bg-down"
                }`}
              />
              <span>{confidence === null ? "Pending" : pct(confidence)}</span>
            </div>
            <Button href="#appraisal-methodology" size="sm">
              Learn more
            </Button>
          </div>
        </div>
        <div className="p-4">
          <Label tracking="tight" className="mb-2 block">
            Value range
          </Label>
          <div className="font-mono text-[19px] tabular-nums">
            {valuation
              ? `${usd(valuation.low, { compact: true })} to ${usd(valuation.high, {
                  compact: true,
                })}`
              : "Pending"}
          </div>
        </div>
      </section>

      <section className="border-b border-line py-8" aria-labelledby="overview-heading">
        <Label className="mb-2 block">Company</Label>
        <h2 id="overview-heading" className="text-[28px] md:text-[32px]">
          Overview
        </h2>
        <p className="mt-4 max-w-3xl text-[17px] leading-[1.65]">{overview}</p>
      </section>

      <AppraisalDetails
        valuation={valuation}
        evidence={company.evidence ?? []}
        sources={company.sources}
        risks={risks}
      />

      <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0">
          <section aria-labelledby="signals-heading">
            {strengths.length ? (
              <div>
                <Label id="signals-heading" className="mb-3 block">Positive signals</Label>
                <ul className="divide-y divide-hairline border-y border-line">
                  {strengths.map((strength) => (
                    <li
                      key={strength}
                      className="flex gap-3 py-3 text-[13px] leading-[1.45]"
                    >
                      <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 bg-up" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="mt-12 border-t border-line pt-8" aria-labelledby="financials-heading">
            <Label className="mb-2 block">Operating record</Label>
            <h2 id="financials-heading" className="text-[30px] md:text-[34px]">
              Financials and investment
            </h2>

            <dl className="mt-6 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Revenue estimate", usd(financials?.revenue_est, { cents: false })],
                ["Owner earnings", usd(financials?.sde_est, { cents: false })],
                ["Operating margin", pct(financials?.margin_est, 1)],
                ["Outside funding found", factValue(funding)],
                [
                  "Owner proceeds on Bartr",
                  usd(company.market?.treasury?.proceeds, { cents: false }),
                ],
                [
                  "Owner stake retained",
                  ownerRetained === null ? "Not available" : pct(ownerRetained),
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-h-24 bg-card p-4">
                  <dt>
                    <Label tracking="tight">{label}</Label>
                  </dt>
                  <dd className="mt-3 font-mono text-[18px] tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-y border-line py-4">
              <div>
                <Label tracking="tight">Financial source</Label>
                <div className="mt-1 text-[13px]">
                  {!financials
                    ? "Not found"
                    : financials.method === "extracted"
                      ? "Reported evidence"
                      : "Operating proxy"}
                </div>
              </div>
              <div>
                <Label tracking="tight">NAICS</Label>
                <div className="mt-1 font-mono text-[13px]">
                  {company.naics_guess || "Not found"}
                </div>
              </div>
              <div>
                <Label tracking="tight">As of</Label>
                <div className="mt-1 font-mono text-[13px]">
                  {valuation?.as_of?.slice(0, 10) || "Pending"}
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="border border-line bg-card" aria-labelledby="ownership-heading">
            <div className="border-b border-line px-3 py-2">
              <h2 id="ownership-heading">
                <Label>Ownership and leadership</Label>
              </h2>
            </div>
            {company.owners.length ? (
              <ul className="divide-y divide-hairline">
                {company.owners.map((owner) => {
                  const initials = owner
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <li key={owner} className="flex items-center gap-3 p-4">
                      <span
                        aria-hidden
                        className="grid size-10 shrink-0 place-items-center bg-primary font-mono text-[11px] text-primary-foreground"
                      >
                        {initials}
                      </span>
                      <div>
                        <div className="text-[15px]">{owner}</div>
                        <Label tracking="tight">Owner on record</Label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-4 text-[13px] text-muted-foreground">
                No owner or founder was confirmed in the reviewed sources.
              </p>
            )}
          </section>

          <section className="border border-line bg-card" aria-labelledby="details-heading">
            <div className="border-b border-line px-3 py-2">
              <h2 id="details-heading">
                <Label>Company details</Label>
              </h2>
            </div>
            <dl className="divide-y divide-hairline">
              {[
                ["Category", category],
                ["Founded", company.founded_year ? String(company.founded_year) : "Not found"],
                ["Address", company.address || place || "Not found"],
                [
                  "Ownership",
                  company.observables?.owner_operated === true
                    ? "Owner operated"
                    : "Not confirmed",
                ],
                [
                  "Equipment",
                  company.observables?.machines
                    ? `${company.observables.machines} machines`
                    : "Not found",
                ],
              ].map(([term, value]) => (
                <div key={term} className="grid grid-cols-[92px_1fr] gap-3 px-3 py-3">
                  <dt>
                    <Label tracking="tight">{term}</Label>
                  </dt>
                  <dd className="text-right text-[13px] leading-[1.4]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border border-line bg-card" aria-labelledby="contact-heading">
            <div className="border-b border-line px-3 py-2">
              <h2 id="contact-heading">
                <Label>Contact</Label>
              </h2>
            </div>
            <div className="flex flex-col gap-3 p-3 text-[13px]">
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-accent-deep underline decoration-accent-deep/40 underline-offset-4"
                >
                  {company.website.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <span className="text-muted-foreground">Website not found</span>
              )}
              {company.phone ? (
                <a
                  href={`tel:${company.phone}`}
                  className="text-accent-deep underline decoration-accent-deep/40 underline-offset-4"
                >
                  {company.phone}
                </a>
              ) : (
                <span className="text-muted-foreground">Phone not found</span>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
