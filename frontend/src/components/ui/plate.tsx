import { cn } from "@/lib/cn";

/**
 * Plate figure. Caption bar fused to the top edge, half-pixel strokes on the body.
 * Prefix is BTR., never LEM. A plate must encode something real.
 */
export function Plate({
  id,
  caption,
  className,
  bodyClassName,
  children,
}: {
  id: string;
  caption?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={cn("flex flex-col", className)}>
      <div className="flex h-8 shrink-0 items-center justify-between gap-3 border border-accent px-3">
        <span className="font-mono text-[10px] text-accent">{id}</span>
        {caption ? <span className="font-mono text-[10px] text-accent tabular-nums">{caption}</span> : null}
      </div>
      <div
        className={cn("bg-background", bodyClassName)}
        style={{ borderLeft: "0.5px solid #755CFE", borderRight: "0.5px solid #755CFE", borderBottom: "0.5px solid #755CFE" }}
      >
        {children}
      </div>
    </figure>
  );
}
