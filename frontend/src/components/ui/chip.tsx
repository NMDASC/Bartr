import { cn } from "@/lib/cn";

type Tone = "down" | "up" | "accent" | "neutral";

/** State chip: border color/40, bg color/8, text full strength. Lemma's three-part recipe. */
export function Chip({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  const tones: Record<Tone, string> = {
    down: "border-down/40 bg-down/[0.08] text-down",
    up: "border-up/40 bg-up/[0.08] text-up",
    accent: "border-accent/40 bg-accent/[0.08] text-accent",
    neutral: "border-tint-400/40 bg-tint-400/[0.08] text-tint-600",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Left-rule callout. */
export function Callout({ tone = "accent", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  const tones: Record<Tone, string> = {
    down: "border-down bg-down/[0.05]",
    up: "border-up bg-up/[0.05]",
    accent: "border-accent bg-accent/[0.05]",
    neutral: "border-tint-400 bg-tint-400/[0.05]",
  };
  return <div className={cn("border-l-2 px-3 py-2.5 text-[14px]", tones[tone], className)}>{children}</div>;
}
