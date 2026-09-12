"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Label } from "@/components/ui/label";

export function Footer() {
  const { session } = useAuth();

  return (
    <footer className="border-t border-line bg-background">
      <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-12 xl:border-l xl:border-r xl:border-line">
        <div className="grid gap-10 md:grid-cols-[1fr_auto]">
          <div className="max-w-md">
            <div className="flex items-center gap-2.5 text-[16px]">
              <span aria-hidden className="inline-block size-3 bg-primary" />
              <span>Bartr</span>
            </div>
            <p className="mt-3 text-[14px] secondary">
              A discovery engine and exchange for the businesses that will never be listed.
            </p>
          </div>
          <div>
            <Label as="h2" className="mb-3">
              Product
            </Label>
            <ul className="space-y-2 text-[14px]">
              {session ? (
                <>
                  <li><Link className="text-muted-foreground hover:text-foreground" href="/overview">Overview</Link></li>
                  <li><Link className="text-muted-foreground hover:text-foreground" href="/search">Discover</Link></li>
                  {session.role === "admin" ? <li><Link className="text-muted-foreground hover:text-foreground" href="/admin">Admin</Link></li> : null}
                </>
              ) : (
                <li><Link className="text-muted-foreground hover:text-foreground" href="/">Home</Link></li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
