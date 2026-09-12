import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SurveillanceDashboard } from "@/components/admin/surveillance-dashboard";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);
  if (!session) redirect("/?auth=login&next=/admin");
  if (session.role !== "admin") redirect("/overview");

  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <SurveillanceDashboard />
    </div>
  );
}
