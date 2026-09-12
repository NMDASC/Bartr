import { notFound } from "next/navigation";
import { getCompany, startAcquisition } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { BackLink } from "@/components/site/back-link";
import { Loi } from "@/components/acquire/loi";
import { Checklist } from "@/components/acquire/checklist";

export const dynamic = "force-dynamic";

export default async function AcquirePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();
  const acq = await startAcquisition(id);
  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="pt-8 pb-6">
        <BackLink fallback={`/company/${id}`} />
        <Label className="mt-4 mb-2 block">Acquire · {company.state ?? "US"} · {company.category}</Label>
        <h1 className="text-[30px] md:text-[40px] leading-[1.1]">{company.name}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_400px] pb-20 border-t border-line pt-6">
        <Loi md={acq.loi_md} />
        <Checklist items={acq.checklist} />
      </div>
    </div>
  );
}
