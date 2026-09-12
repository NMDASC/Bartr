import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Minimal markdown: headings, bold, hr, paragraphs. Enough for an LOI, no dependency. */
function render(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push(
        <p key={out.length} className="text-[16px] leading-[1.6] text-pretty">
          {para.map((ln, k) => (
            <span key={k}>
              {inline(ln)}
              {k < para.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>,
      );
      para = [];
    }
  };
  lines.forEach((l) => {
    if (l.startsWith("# ")) { flush(); out.push(<h2 key={out.length} className="text-[30px] leading-[1.15] tracking-[-0.01em] mt-2 mb-6">{l.slice(2)}</h2>); }
    else if (l.startsWith("## ")) { flush(); out.push(<h3 key={out.length} className="text-[20px] leading-[1.15] tracking-[-0.01em] mt-8 mb-2">{l.slice(3)}</h3>); }
    else if (l.trim() === "---") { flush(); out.push(<hr key={out.length} className="my-6 border-line" />); }
    else if (l.trim() === "") flush();
    else para.push(l);
  });
  flush();
  return out;
}

function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**")) return <strong key={i} className="font-medium">{p.slice(2, -2)}</strong>;
    if (p.startsWith("_")) return <span key={i} className="secondary">{p.slice(1, -1)}</span>;
    return p;
  });
}

export function Loi({ md, closingHref }: { md: string; closingHref?: string }) {
  return (
    <article className="bg-card border border-line">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <Label>Letter of intent</Label>
        <div className="flex gap-2">
          <Button size="sm">Edit with agent</Button>
          {closingHref ? (
            <Button size="sm" variant="positive" href={closingHref}>
              Proceed to closing
            </Button>
          ) : null}
        </div>
      </div>
      <div className="p-6 md:p-8 max-w-[72ch]">{render(md)}</div>
    </article>
  );
}
