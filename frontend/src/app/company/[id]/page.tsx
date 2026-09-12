import { BackLink } from "@/components/site/back-link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/api";
import { MarketPanel } from "@/components/company/market-panel";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  const place = [company.city, company.state].filter(Boolean).join(", ");

  return (
    <>
      <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
        <div className="pt-8 pb-6">
          <BackLink fallback="/search?q=laundromat%20in%20Pittsburgh" />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Label>
              {company.category}
              {place ? ` · ${place}` : ""}
            </Label>
            {company.status === "ready" ? <Chip tone="up">Priced</Chip> : <Chip tone="accent">Reading</Chip>}
          </div>
          <h1 className="mt-2 text-[30px] md:text-[40px] 3xl:text-[48px] leading-[1.1]">{company.name}</h1>
          {company.description ? <p className="mt-subhead max-w-2xl text-[16px] secondary">{company.description}</p> : null}
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
            {company.rating !== null ? (
              <div className="flex gap-2">
                <dt className="uppercase tracking-[0.08em]">Rating</dt>
                <dd className="text-foreground tabular-nums">{company.rating.toFixed(1)} ({company.review_count})</dd>
              </div>
            ) : null}
            {company.founded_year ? (
              <div className="flex gap-2">
                <dt className="uppercase tracking-[0.08em]">Since</dt>
                <dd className="text-foreground tabular-nums">{company.founded_year}</dd>
              </div>
            ) : null}
            {company.owners.length ? (
              <div className="flex gap-2">
                <dt className="uppercase tracking-[0.08em]">Owner</dt>
                <dd className="text-foreground">{company.owners.join(", ")}</dd>
              </div>
            ) : null}
            {company.website ? (
              <div className="flex gap-2">
                <dt className="uppercase tracking-[0.08em]">Web</dt>
                <dd>
                  <a className="text-accent-deep underline underline-offset-[0.15em] decoration-accent-deep/40 hover:decoration-accent-deep" href={company.website} target="_blank" rel="noreferrer">
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
      <MarketPanel company={company} />
    </>
  );
}
