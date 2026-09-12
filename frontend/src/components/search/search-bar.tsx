"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export function SearchBar({ initial = "", className, autoFocus }: { initial?: string; className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      className={cn("flex items-stretch gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <label htmlFor="q" className="sr-only">
        Describe the business you want
      </label>
      <Input
        id="q"
        name="q"
        value={q}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
        placeholder="laundromat in Oklahoma under 1.2M"
        className="h-11 text-[16px]"
      />
      <Button type="submit" variant="primary" size="lg" className="h-11 shrink-0">
        Search
      </Button>
    </form>
  );
}
