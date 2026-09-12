import { BackLink } from "@/components/site/back-link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/api";
import { MarketPanel } from "@/components/company/market-panel";
import { Label } from "@/components/ui/label";
import { BusinessAvatar, categoryName } from "@/components/dashboard/shared";
import { Chip } from "@/components/ui/chip";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  const place = [company.city, company.state].filter(Boolean).join(", ");

  return (
    <>
      <div className="page-wrap !pb-4">
        <div className="pb-2">
          <BackLink fallback="/search?q=laundromat%20in%20Pittsburgh" />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Label>
              {categoryName(company.category)}
              {place ? ` · ${place}` : ""}
            </Label>
            {company.status === "ready" ? <Chip tone="up">Priced</Chip> : <Chip tone={company.status==="failed"?"down":"accent"}>{company.status==="failed"?"Pricing unavailable":"Reading"}</Chip>}
          </div>
          <div className="mt-4 flex items-center gap-4"><BusinessAvatar category={company.category} large/><h1 className="text-[26px] md:text-[34px] tracking-[-.04em]">{company.name}</h1></div>
          {company.description ? <p className="mt-3 max-w-2xl text-[13px] secondary">{company.description}</p> : null}
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
