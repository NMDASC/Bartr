import { NextResponse } from "next/server";

import {
  AUTH_COOKIE,
  adminCredentialsMatch,
  createSessionToken,
  isAdminEmail,
  sessionCookie,
} from "@/lib/auth/session";
import type { AuthSession } from "@/lib/auth/types";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!EMAIL.test(email) || password.length < 8) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (isAdminEmail(email) && !adminCredentialsMatch(email, password)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session: AuthSession = adminCredentialsMatch(email, password)
    ? { name: "Admin", email, role: "admin" }
    : { name: email.split("@")[0], email, role: "user" };

  const response = NextResponse.json({ user: session });
  response.cookies.set(AUTH_COOKIE, createSessionToken(session), sessionCookie);
  return response;
}
