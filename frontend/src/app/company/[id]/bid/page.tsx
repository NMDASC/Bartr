import { notFound } from "next/navigation";

import { MarketPanel } from "@/components/company/market-panel";
import { BackLink } from "@/components/site/back-link";
import { Label } from "@/components/ui/label";
import { getCompany } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function CompanyBidPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  const place = [company.city, company.state].filter(Boolean).join(", ");

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:border-x xl:border-line 3xl:max-w-8xl">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-5 pt-6">
          <div>
            <BackLink fallback={`/company/${id}`} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Label>
                {company.category}
                {place ? ` · ${place}` : ""}
              </Label>
            </div>
            <h1 className="mt-2 text-[28px] leading-[1.08] md:text-[36px]">{company.name}</h1>
          </div>
        </div>
      </div>
      <MarketPanel company={company} />
    </>
  );
}
