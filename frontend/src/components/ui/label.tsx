import { cn } from "@/lib/cn";

/** Uppercase IBM Plex Mono eyebrow. Tracking ladder: 0.06 to 0.15em. */
export function Label({
  children,
  className,
  tracking = "wide",
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  tracking?: "tight" | "normal" | "wide";
  as?: "span" | "div" | "p" | "h2" | "h3" | "th" | "dt";
}) {
  const t = { tight: "tracking-[0.06em]", normal: "tracking-[0.1em]", wide: "tracking-[0.14em]" }[tracking];
  return <Tag className={cn("font-mono text-[10px] leading-[1.25] uppercase text-muted-foreground", t, className)}>{children}</Tag>;
}
