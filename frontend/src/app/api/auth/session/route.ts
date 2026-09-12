import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);
  return NextResponse.json({ user });
}
