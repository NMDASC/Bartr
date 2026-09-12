"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import {
  allSigned,
  closedHref,
  documentsFor,
  sign,
  type Buyer,
  type Deal,
  type Signature,
} from "@/lib/closing";
import { clock, pct, usd } from "@/lib/format";

function SignatureMark({ signature }: { signature: Signature }) {
  return (
    <div className="bartr-fade-up">
      <div
        className="text-[30px] leading-none text-primary"
        style={{ fontFamily: '"Snell Roundhand", "Apple Chancery", "Brush Script MT", "Segoe Script", cursive', fontStyle: "italic" }}
      >
        {signature.signer}
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        Signed {clock(signature.at)} · {signature.ref}
      </div>
    </div>
  );
}

export function ClosingDocuments({ deal, buyer }: { deal: Deal; buyer: Buyer }) {
  const router = useRouter();
  const documents = useMemo(() => documentsFor(deal, buyer), [deal, buyer]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [leaving, setLeaving] = useState(false);
  const opened = useMemo(() => new Date().toISOString(), []);
  const complete = allSigned(documents, signatures);
  const signedIds = new Set(signatures.map((s) => s.documentId));

  function signOne(id: string) {
    const document = documents.find((d) => d.id === id);
    if (!document || signedIds.has(id)) return;
    setSignatures((prev) => [...prev, sign(document, buyer.name)]);
  }

  function signAll() {
    const now = new Date().toISOString();
    setSignatures(documents.filter((d) => !signedIds.has(d.id)).map((d) => sign(d, buyer.name, now)).concat(signatures));
  }

  function finish() {
    if (!complete || leaving) return;
    setLeaving(true);
    try {
      window.sessionStorage.setItem(
        `bartr:closing:${deal.companyId}:${deal.orderId ?? deal.kind}`,
        JSON.stringify({ deal, signatures, at: new Date().toISOString() }),
      );
    } catch {
      // the record is a convenience
    }
    router.push(closedHref(deal.companyId, deal));
  }

  return (
    <div className="grid gap-6 pb-20 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-6">
        {documents.map((document, index) => {
          const signature = signatures.find((s) => s.documentId === document.id);
          return (
            <article key={document.id} className="border border-line bg-card">
              <div className="flex h-8 items-center justify-between border-b border-line px-3">
                <Label>
                  {index + 1} of {documents.length} · {document.title}
                </Label>
                {signature ? <Chip tone="up">Signed</Chip> : <Chip tone="accent">Awaiting signature</Chip>}
              </div>
              <div className="max-w-[72ch] p-6 md:p-8">
                <h2 className="text-[28px] leading-[1.15] tracking-[-0.01em]">{document.title}</h2>
                {document.sections.map((section) => (
                  <section key={section.heading} className="mt-6">
                    <h3 className="text-[15px] font-medium">{section.heading}</h3>
                    <p className="mt-1.5 text-[15px] leading-[1.6] text-pretty">{section.text}</p>
                  </section>
                ))}
                <div className="mt-8 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
                  <div>
                    <Label tracking="tight" className="mb-3 block">
                      {document.counterparty}
                    </Label>
                    {signature ? (
                      <SignatureMark signature={{ documentId: document.id, signer: "Bartr Treasury", at: signature.at, ref: `COUNTERSIGN ${signature.ref}` }} />
                    ) : (
                      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Countersigns on your signature · opened {clock(opened)}</p>
                    )}
                  </div>
                  <div>
                    <Label tracking="tight" className="mb-3 block">
                      {buyer.name}
                    </Label>
                    {signature ? (
                      <SignatureMark signature={signature} />
                    ) : (
                      <Button variant="primary" onClick={() => signOne(document.id)}>
                        Sign
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <aside className="self-start border border-line bg-card lg:sticky lg:top-6">
        <div className="flex h-8 items-center justify-between border-b border-line px-3">
          <Label>Closing</Label>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {signatures.length}/{documents.length} signed
          </span>
        </div>
        <div className="h-px bg-tint-300">
          <div
            className="h-px bg-up transition-[width] duration-300 ease-out"
            style={{ width: `${(signatures.length / Math.max(1, documents.length)) * 100}%` }}
          />
        </div>
        <dl className="divide-y divide-hairline">
          {[
            ["Company", deal.companyName],
            [deal.kind === "whole" ? "Purchase" : "Shares", deal.kind === "whole" ? "Whole business" : deal.qty.toLocaleString("en-US")],
            ["Stake", pct(deal.pct, deal.pct < 0.1 ? 2 : 1)],
            [deal.kind === "whole" ? "Price" : "Per share", deal.kind === "whole" ? usd(deal.price, { cents: false }) : usd(deal.price)],
            ["Total", usd(deal.total, { cents: deal.kind !== "whole" })],
            ["Buyer", buyer.name],
          ].map(([term, value]) => (
            <div key={term} className="grid grid-cols-[92px_1fr] gap-3 px-3 py-3">
              <dt>
                <Label tracking="tight">{term}</Label>
              </dt>
              <dd className="text-right font-mono text-[13px] tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 border-t border-line p-3">
          <Button onClick={signAll} disabled={complete} className="w-full">
            Sign all
          </Button>
          <Button variant="positive" size="lg" onClick={finish} disabled={!complete || leaving} className="w-full">
            {leaving ? "Closing" : "Complete closing"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
