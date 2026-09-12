"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/overview", label: "Overview", match: "/overview" },
  { href: "/search?q=laundromat%20in%20Pittsburgh", label: "Discover", match: "/search" },
  { href: "/portfolio", label: "Portfolio", match: "/portfolio" },
  { href: "/agent", label: "Agent", match: "/agent" },
];

export function Header() {
  const path = usePathname();
  const { session, openAuth, logout } = useAuth();
  const appNav = session?.role === "admin"
    ? [...nav, { href: "/admin", label: "Admin", match: "/admin" }]
    : nav;

  return (
    <header className="bg-background">
      <div className="mx-auto flex h-14 max-w-7xl 3xl:max-w-8xl items-center justify-between px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
        <Link
          href={session ? (session.role === "admin" ? "/admin" : "/overview") : "/"}
          className="flex items-center gap-2.5 text-[16px] text-foreground"
        >
          <span aria-hidden className="inline-block size-3 bg-primary" />
          <span>Bartr</span>
        </Link>
        {session ? (
          <>
            <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
              {appNav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "text-[14px] transition-colors duration-150 ease-out hover:text-foreground",
                    path.startsWith(n.match) ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <span className="hidden max-w-40 truncate font-mono text-[10px] text-muted-foreground sm:block">
                {session.email}
              </span>
              <Button variant="secondary" size="sm" onClick={() => void logout()}>
                Logout
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => openAuth("login")}>
              Login
            </Button>
            <Button variant="primary" size="sm" onClick={() => openAuth("signup")}>
              Start trading
            </Button>
          </div>
        )}
      </div>
      {session ? (
        <nav
          aria-label="Primary mobile"
          className="mx-auto flex max-w-7xl overflow-x-auto border-t border-line px-4 md:hidden"
        >
          {appNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em]",
                path.startsWith(item.match)
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
