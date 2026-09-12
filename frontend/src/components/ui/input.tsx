import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg bg-input px-3 text-[14px] text-foreground placeholder:text-muted-foreground border border-line transition-colors duration-150 ease-out focus-visible:border-accent focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg bg-input px-3 text-[13px] text-foreground border border-line focus-visible:border-accent focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
