import { notFound, redirect } from "next/navigation";

import { Celebration } from "@/components/closing/celebration";
import { getCompany } from "@/lib/api";
import { dealFromParams } from "@/lib/closing";

export const dynamic = "force-dynamic";

export default async function ClosedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  const deal = dealFromParams(company, query);
  if (!deal) redirect(`/company/${id}`);
  return <Celebration deal={deal} />;
}
