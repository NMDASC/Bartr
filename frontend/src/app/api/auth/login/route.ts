import { NextResponse } from "next/server";

import {
  AUTH_COOKIE,
  adminCredentialsMatch,
  createSessionToken,
  isAdminIdentifier,
  sessionCookie,
} from "@/lib/auth/session";
import type { AuthSession } from "@/lib/auth/types";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Enter your email or username and password." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const isConfiguredAdmin = isAdminIdentifier(email);
  const isAdmin = adminCredentialsMatch(email, password);

  if (password.length < 8 || (!isConfiguredAdmin && !EMAIL.test(email))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (isConfiguredAdmin && !isAdmin) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session: AuthSession = isAdmin
    ? { name: "Admin", email, role: "admin" }
    : { name: email.split("@")[0], email, role: "user" };

  const response = NextResponse.json({ user: session });
  response.cookies.set(AUTH_COOKIE, createSessionToken(session), sessionCookie);
  return response;
}
