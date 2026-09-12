import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthSession } from "./types";

export const AUTH_COOKIE = "bartr_session";
export const AUTH_MAX_AGE = 60 * 60 * 8;

const DEVELOPMENT_SECRET = "bartr-demo-session-development-only";

function secret() {
  return process.env.DEMO_AUTH_SECRET || DEVELOPMENT_SECRET;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(session: AuthSession) {
  const payload = encode(
    JSON.stringify({
      ...session,
      expiresAt: Date.now() + AUTH_MAX_AGE * 1000,
    }),
  );
  return `${payload}.${signature(payload)}`;
}

export function readSessionToken(token: string | undefined): AuthSession | null {
  if (!token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;

  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const parsed = JSON.parse(decode(payload)) as AuthSession & { expiresAt: number };
    if (
      parsed.expiresAt <= Date.now() ||
      !parsed.name ||
      !parsed.email ||
      !["user", "admin"].includes(parsed.role)
    ) {
      return null;
    }
    return { name: parsed.name, email: parsed.email, role: parsed.role };
  } catch {
    return null;
  }
}

export function adminCredentialsMatch(email: string, password: string) {
  const adminEmail = (process.env.DEMO_ADMIN_EMAIL || "admin@gmail.com").toLowerCase();
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || "admin1234";
  return email.toLowerCase() === adminEmail && password === adminPassword;
}

export function isAdminEmail(email: string) {
  return email.toLowerCase() === (process.env.DEMO_ADMIN_EMAIL || "admin@gmail.com").toLowerCase();
}

export const sessionCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: AUTH_MAX_AGE,
};
