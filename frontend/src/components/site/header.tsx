"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/search?q=laundromat%20in%20Oklahoma", label: "Discover", match: "/search" },
  { href: "/portfolio", label: "Portfolio", match: "/portfolio" },
  { href: "/surveillance", label: "Surveillance", match: "/surveillance" },
  { href: "/agent", label: "Agent", match: "/agent" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="bg-background">
      <div className="mx-auto flex h-14 max-w-7xl 3xl:max-w-8xl items-center justify-between px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
        <Link href="/" className="flex items-center gap-2.5 text-[16px] text-foreground">
          <span aria-hidden className="inline-block size-3 bg-primary" />
          <span>JB</span>
        </Link>
        <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
          {nav.map((n) => (
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
          <Button variant="secondary" size="sm" href="/portfolio">
            Login
          </Button>
          <Button variant="primary" size="sm" href="/search?q=laundromat%20in%20Oklahoma">
            Start trading
          </Button>
        </div>
      </div>
    </header>
  );
}
