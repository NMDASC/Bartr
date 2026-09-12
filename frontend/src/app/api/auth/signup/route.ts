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

  // Optional and incidental: the dialog does not ask for it, so anything arriving
  // here is an autofill. Unparseable means unpaired, never a failed signup. An
  // account pairs its iMessage number later, in the Agent section.
  const phone = normalizePhone(body.phone);

  const session: AuthSession = { name, email, role: "user", phone };
  const response = NextResponse.json({ user: session });
  response.cookies.set(AUTH_COOKIE, createSessionToken(session), sessionCookie);
  return response;
}
