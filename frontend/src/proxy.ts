import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";

function loginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("auth", "login");
  url.searchParams.set("next", destination);
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const session = readSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!session) return loginRedirect(request);

  const path = request.nextUrl.pathname;
  if (path === "/admin" || path.startsWith("/admin/")) {
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL("/overview", request.url));
    }
  }

  if (path === "/surveillance" || path.startsWith("/surveillance/")) {
    return NextResponse.redirect(
      new URL(session.role === "admin" ? "/admin" : "/overview", request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/overview/:path*",
    "/search/:path*",
    "/agent/:path*",
    "/company/:path*",
    "/admin/:path*",
    "/surveillance/:path*",
  ],
};
