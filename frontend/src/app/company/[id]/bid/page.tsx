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
        <div className="pb-6 pt-8">
          <BackLink fallback={`/company/${id}`} />
          <Label className="mb-2 mt-4 block">
            {company.listed ? "Acquisition market" : "Acquisition offer"}
            {place ? ` · ${place}` : ""}
          </Label>
          <h1 className="text-[30px] leading-[1.1] md:text-[40px]">
            Bid for {company.name}
          </h1>
        </div>
      </div>
      <MarketPanel company={company} />
    </>
  );
}
