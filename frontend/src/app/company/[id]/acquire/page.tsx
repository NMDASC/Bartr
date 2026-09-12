import { notFound } from "next/navigation";
import { getCompany } from "@/lib/api";
import { BackLink } from "@/components/site/back-link";
import { AcquisitionWorkspace } from "@/components/acquire/workspace";
import { categoryName } from "@/components/dashboard/shared";
export default async function AcquirePage({params}:{params:Promise<{id:string}>}){const{id}=await params;const company=await getCompany(id);if(!company)notFound();return <div className="page-wrap"><BackLink fallback={`/company/${id}`}/><p className="eyebrow mt-6 mb-2">Acquisition · {company.state??"US"} · {categoryName(company.category)}</p><h1 className="page-title">Make it your next chapter.</h1><p className="page-subtitle mb-7">{company.name}</p><AcquisitionWorkspace companyId={id}/></div>;}
