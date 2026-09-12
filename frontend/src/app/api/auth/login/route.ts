import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  AUTH_COOKIE,
  adminCredentialsMatch,
  createSessionToken,
  isAdminIdentifier,
  readSessionToken,
  sessionCookie,
} from "@/lib/auth/session";
import type { AuthSession } from "@/lib/auth/types";
import { normalizePhone } from "@/lib/auth/account";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  let body: { email?: string; password?: string; phone?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Enter your email or username and password." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const isConfiguredAdmin = isAdminIdentifier(email);
  const isAdmin = adminCredentialsMatch(email, password);

  // Configured demo accounts may intentionally use short credentials (for
  // local demos); regular email logins still require the normal minimum.
  if ((!isAdmin && password.length < 8) || (!isConfiguredAdmin && !EMAIL.test(email))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (isConfiguredAdmin && !isAdmin) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Optional and incidental: the dialog does not ask for it, so anything arriving
  // here is an autofill. Unparseable means unpaired, never a failed login.
  //
  // Logging in issues a new cookie, and the pairing lives in that cookie, so a
  // plain re-login would silently unpair the same person and their texts would
  // start landing on a second account. Carry it over when the email matches.
  const jar = await cookies();
  const prior = readSessionToken(jar.get(AUTH_COOKIE)?.value);
  const phone =
    normalizePhone(body.phone) ?? (prior && prior.email === email ? prior.phone ?? null : null);

  const session: AuthSession = isAdmin
    ? { name: "Admin", email, role: "admin", phone }
    : { name: email.split("@")[0], email, role: "user", phone };

  const response = NextResponse.json({ user: session });
  response.cookies.set(AUTH_COOKIE, createSessionToken(session), sessionCookie);
  return response;
}
