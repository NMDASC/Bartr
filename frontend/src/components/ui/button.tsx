import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap font-mono uppercase font-normal " +
  "transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.96] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none";

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-[10px]",
  md: "px-4 py-2 text-[11px] 3xl:text-[13px]",
  lg: "px-5 py-2.5 text-[11px] 3xl:text-[13px]",
};

const variants: Record<Variant, string> = {
  primary: "group bg-primary text-white",
  secondary: "bg-surface text-primary hover:bg-surface-hover",
  ghost: "bg-transparent text-muted-foreground hover:text-primary",
};

function Inner({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  if (variant !== "primary") return <>{children}</>;
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
        style={{ background: "linear-gradient(135deg, #322C8A 0%, #5D4EE7 50%, #1D1956 100%)" }}
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </>
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
}

export function Button({ variant = "secondary", size = "md", href, className, children, ...props }: ButtonProps) {
  const cls = cn(base, sizes[size], variants[variant], className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        <Inner variant={variant}>{children}</Inner>
      </Link>
    );
  }
  return (
    <button className={cls} {...props}>
      <Inner variant={variant}>{children}</Inner>
    </button>
  );
}
