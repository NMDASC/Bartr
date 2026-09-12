"use client";

import { useRouter } from "next/navigation";

export function BackLink({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:text-accent transition-colors duration-150 ease-out"
    >
      Back
    </button>
  );
}
