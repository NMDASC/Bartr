"use client";

import { useState } from "react";
import type { Company, Offer } from "@contracts/types";
import { makeOffer, acceptOffer } from "@/lib/api";
import { usd } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** A discovered business the owner has not listed. Shows our estimate and takes an offer to the owner. */
export function OfferPanel({ company }: { company: Company }) {
  const v = company.valuation;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [price, setPrice] = useState<string>(v ? String(Math.round(v.v0)) : "");
  const [message, setMessage] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [showLetter, setShowLetter] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const o = await makeOffer(company._id, {
        buyer_name: name.trim(), buyer_email: email.trim(), buyer_phone: phone.trim() || undefined,
        price: price ? Number(price) : undefined, message: message.trim() || undefined, owner_email: ownerEmail.trim() || undefined,
      });
      setOffer(o);
    } catch {
      setError("The offer could not be sent. Check the fields and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!offer) return;
    setBusy(true);
    try {
      await acceptOffer(offer._id);
      window.location.reload();
    } finally {
      setBusy(false);
    }
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
        <p className="mt-3 text-[13px] secondary">
          This business has been found and appraised, but the owner has not put it up for sale. You can make an offer and we will write to them on your behalf.
        </p>
      </div>

      {offer ? (
        <div className="px-3 py-3 flex flex-col gap-3">
          <p className="text-[14px]">
            {offer.delivery === "queued" || offer.delivery === "preview"
              ? `Your offer of ${usd(offer.price, { compact: true })} is ready. We will deliver it to the owner as soon as we have a way to reach them.`
              : `Your offer of ${usd(offer.price, { compact: true })} has been sent to the owner.`}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowLetter((s) => !s)}>{showLetter ? "Hide the letter" : "Read the letter"}</Button>
            <Button size="sm" variant="primary" onClick={accept} disabled={busy}>Owner accepts (demo)</Button>
          </div>
          {showLetter ? (
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-[1.55] border border-line bg-surface p-3">{offer.email.body}</pre>
          ) : null}
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
              <Input type="number" min={1} step={1000} value={price} onChange={(e) => setPrice(e.target.value)} className="tabular-nums" />
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
          <Button type="submit" variant="primary" size="lg" disabled={busy || !name.trim() || !email.trim()}>
            {busy ? "Sending" : "Make the offer"}
          </Button>
        </form>
      )}
    </div>
  );
}
