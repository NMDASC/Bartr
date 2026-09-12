import { NextResponse } from "next/server";

import { AUTH_COOKIE, sessionCookie } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "", { ...sessionCookie, maxAge: 0 });
  return response;
}
