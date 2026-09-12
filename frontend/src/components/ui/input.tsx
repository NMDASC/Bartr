import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full bg-input px-3 text-[14px] text-foreground placeholder:text-foreground/45 border border-transparent transition-colors duration-150 ease-out focus-visible:border-accent focus-visible:outline-none",
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
        "h-10 w-full bg-input px-3 text-[14px] text-foreground border border-transparent focus-visible:border-accent focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
