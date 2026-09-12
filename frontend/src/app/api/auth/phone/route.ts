import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  AUTH_COOKIE,
  createSessionToken,
  readSessionToken,
  sessionCookie,
} from "@/lib/auth/session";
import { normalizePhone } from "@/lib/auth/account";
import type { AuthSession } from "@/lib/auth/types";

/**
 * Pairs an iMessage number with the signed-in session, or clears it with an
 * empty body. The number becomes the identity this session sends to the API,
 * which is what puts a texted order and the web account on one uid.
 *
 * Demo state, like the rest of this auth: there is no possession check on the
 * number, the same as decision 023.
 */
export async function POST(request: Request) {
  const jar = await cookies();
  const session = readSessionToken(jar.get(AUTH_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  let body: { phone?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Enter a mobile number." }, { status: 400 });
  }

  const raw = (body.phone ?? "").trim();
  const phone = raw ? normalizePhone(raw) : null;
  if (raw && !phone) {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }

  const next: AuthSession = { ...session, phone };
  const response = NextResponse.json({ user: next });
  response.cookies.set(AUTH_COOKIE, createSessionToken(next), sessionCookie);
  return response;
}
