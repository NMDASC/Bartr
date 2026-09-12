import type { OfferDraft } from "@/lib/offer-letter";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import { clock, usd } from "@/lib/format";

/** The letter as it went to the owner. Fills the column the order book uses on a listed company. */
export function OfferLetter({ offer }: { offer: OfferDraft }) {
  return (
    <section className="bg-card border border-line" aria-label="Offer letter">
      <div className="flex h-8 items-center justify-between border-b border-line px-3">
        <Label>Offer letter</Label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{clock(offer.sentAt)}</span>
          <Chip tone="up">Sent</Chip>
        </div>
      </div>
      <dl className="grid gap-px border-b border-line bg-line sm:grid-cols-3">
        <div className="bg-card p-3">
          <dt><Label tracking="tight">To</Label></dt>
          <dd className="mt-1 break-all text-[13px]">{offer.to ?? "Owner on record"}</dd>
        </div>
        <div className="bg-card p-3">
          <dt><Label tracking="tight">Subject</Label></dt>
          <dd className="mt-1 text-[13px]">{offer.subject}</dd>
        </div>
        <div className="bg-card p-3">
          <dt><Label tracking="tight">Offer</Label></dt>
          <dd className="mt-1 font-mono text-[15px] tabular-nums">{usd(offer.price, { cents: false })}</dd>
        </div>
      </dl>
      <pre className="whitespace-pre-wrap break-words p-4 font-sans text-[14px] leading-[1.6] text-foreground">{offer.body}</pre>
    </section>
  );
}
