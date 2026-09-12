import { NextResponse } from "next/server";

import {
  AUTH_COOKIE,
  adminCredentialsMatch,
  createSessionToken,
  isAdminIdentifier,
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

  const phone = normalizePhone(body.phone);
  if ((body.phone ?? "").trim() && !phone) {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }

  const session: AuthSession = isAdmin
    ? { name: "Admin", email, role: "admin", phone }
    : { name: email.split("@")[0], email, role: "user", phone };

  const response = NextResponse.json({ user: session });
  response.cookies.set(AUTH_COOKIE, createSessionToken(session), sessionCookie);
  return response;
}
