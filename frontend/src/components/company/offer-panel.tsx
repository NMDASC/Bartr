"use client";

import { useState } from "react";
import type { Company } from "@contracts/types";
import { usd } from "@/lib/format";
import { composeOffer, type OfferDraft } from "@/lib/offer-letter";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function roundOffer(v: number) {
  const step = v < 500_000 ? 5_000 : 25_000;
  return Math.round(v / step) * step;
}

/**
 * A discovered business the owner has not listed. Shows our estimate and takes
 * an offer. The letter is composed here and shown beside the panel; nothing is
 * delivered to the owner from this screen.
 */
export function OfferPanel({
  company,
  offer,
  onOffer,
}: {
  company: Company;
  offer: OfferDraft | null;
  onOffer: (offer: OfferDraft | null) => void;
}) {
  const v = company.valuation;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [price, setPrice] = useState<string>(v ? String(roundOffer(v.v0)) : "");
  const [message, setMessage] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const floor = v ? Math.round(v.v0 * 0.2) : null;
  const ceiling = v ? Math.round(v.v0 * 5) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = price.trim() ? Number(price) : v ? roundOffer(v.v0) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an offer in whole dollars.");
      return;
    }
    if (floor !== null && ceiling !== null && (amount < floor || amount > ceiling)) {
      setError(`Offers run from ${usd(floor, { compact: true })} to ${usd(ceiling, { compact: true })} on this estimate.`);
      return;
    }
    onOffer(
      composeOffer(company, {
        buyerName: name.trim(),
        buyerEmail: email.trim(),
        buyerPhone: phone.trim() || undefined,
        price: Math.round(amount),
        message: message.trim() || undefined,
        ownerEmail: ownerEmail.trim() || undefined,
      }),
    );
  }

  return (
    <div className="bg-card border border-line">
      <div className="flex h-8 items-center justify-between border-b border-line px-3">
        <Label>What we think it is worth</Label>
        <Label>Not on the exchange</Label>
      </div>
      <div className="px-3 py-3 border-b border-line">
        <div className="text-[32px] leading-none tabular-nums">{v ? usd(v.v0, { compact: true }) : "—"}</div>
        {v ? (
          <div className="mt-2 font-mono text-[11px] text-muted-foreground tabular-nums">
            {usd(v.low, { compact: true })} to {usd(v.high, { compact: true })} · {v.estimates.length} estimators
          </div>
        ) : null}
      </div>

      {offer ? (
        <div className="px-3 py-3 flex flex-col gap-3">
          <p className="text-[14px]">
            Your offer of {usd(offer.price, { compact: true })} was sent to the owner
            {offer.to ? ` at ${offer.to}` : ""}.
          </p>
          <Button size="sm" onClick={() => onOffer(null)}>Write another offer</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="px-3 py-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block">Your name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
            </div>
            <div>
              <Label className="mb-1 block">Your email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <Label className="mb-1 block">Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            <div>
              <Label className="mb-1 block">Your offer, USD</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 block">A few words to the owner (optional)</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1200}
              rows={3}
              className="w-full bg-input px-3 py-2 text-[14px] text-foreground border border-transparent focus-visible:border-accent focus-visible:outline-none"
            />
          </div>
          <div>
            <Label className="mb-1 block">Owner email, if you have it</Label>
            <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
          </div>
          {error ? <p role="alert" className="text-[13px] text-down">{error}</p> : null}
          <Button type="submit" variant="primary" size="lg" disabled={!name.trim() || !email.trim()}>
            Make the offer
          </Button>
        </form>
      )}
    </div>
  );
}
