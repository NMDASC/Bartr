"use client";

import { ArrowRight, Search } from "lucide-react";
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
      className={cn("relative flex items-stretch gap-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <label htmlFor="q" className="sr-only">
        Describe the business you want
      </label>
      <Search size={18} className="absolute left-4 top-4 text-tint-400"/>
      <Input
        id="q"
        name="q"
        value={q}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
        placeholder="laundromat in Pittsburgh under 1.2M"
        className="h-12 pl-11 !bg-white text-[14px]"
      />
      <Button type="submit" variant="primary" size="lg" className="h-12 shrink-0">
        Search <ArrowRight size={15}/>
      </Button>
    </form>
  );
}
