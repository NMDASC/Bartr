import { NextResponse } from "next/server";

import {
  AUTH_COOKIE,
  createSessionToken,
  isAdminIdentifier,
  sessionCookie,
} from "@/lib/auth/session";
import type { AuthSession } from "@/lib/auth/types";
import { normalizePhone } from "@/lib/auth/account";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string; phone?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Complete all fields." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (name.length < 2) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
  }
  if (isAdminIdentifier(email)) {
    return NextResponse.json({ error: "Use login for this account." }, { status: 409 });
  }

  // Optional, and only rejected when something was actually typed. An account
  // without a number still works on the web; it just has no iMessage half.
  const phone = normalizePhone(body.phone);
  if ((body.phone ?? "").trim() && !phone) {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }

  const session: AuthSession = { name, email, role: "user", phone };
  const response = NextResponse.json({ user: session });
  response.cookies.set(AUTH_COOKIE, createSessionToken(session), sessionCookie);
  return response;
}
