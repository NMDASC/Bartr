import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  const adminToken = process.env.ADMIN_API_TOKEN?.trim();
  if (!apiUrl || !adminToken) {
    return NextResponse.json({ error: "Administrator access is not configured." }, { status: 503 });
  }

  try {
    const upstream = await fetch(`${apiUrl}/api/v1/surveillance/flags?max_reviews=0`, {
      headers: {
        "x-admin-token": adminToken,
        "x-demo-user": session.email,
      },
      cache: "no-store",
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Surveillance API is unavailable." }, { status: 502 });
  }
}
