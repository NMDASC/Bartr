import { notFound } from "next/navigation";

import { CompanyOverview } from "@/components/company/company-overview";
import { getCompany } from "@/lib/api";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  return <CompanyOverview company={company} />;
}
