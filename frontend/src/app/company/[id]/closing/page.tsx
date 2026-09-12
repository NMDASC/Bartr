import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ClosingDocuments } from "@/components/closing/documents";
import { Label } from "@/components/ui/label";
import { getCompany } from "@/lib/api";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";
import { dealFromParams } from "@/lib/closing";

export const dynamic = "force-dynamic";

export default async function ClosingPage({
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
  if (!deal) redirect(`/company/${id}/bid`);

  const session = readSessionToken((await cookies()).get(AUTH_COOKIE)?.value);
  const buyer = {
    name: session?.name && session.name !== session.email.split("@")[0] ? session.name : session?.email ?? "Buyer",
    email: session?.email ?? "buyer@bartr.app",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:border-x xl:border-line 3xl:max-w-8xl">
      <div className="pb-6 pt-8">
        <Label className="mb-2 block">
          {deal.kind === "whole" ? "Acquisition closing" : "Share transfer closing"} · {company.category.replaceAll("_", " ")}
          {deal.place ? ` · ${deal.place}` : ""}
        </Label>
        <h1 className="text-[30px] leading-[1.1] md:text-[40px]">{company.name}</h1>
      </div>
      <div className="border-t border-line pt-6">
        <ClosingDocuments deal={deal} buyer={buyer} />
      </div>
    </div>
  );
}
