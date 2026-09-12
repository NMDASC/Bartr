import type { Company } from "@contracts/types";

export interface OfferDraft {
  price: number;
  to: string | null;
  subject: string;
  body: string;
  buyerName: string;
  sentAt: string;
}

export interface OfferFields {
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  price: number;
  message?: string;
  ownerEmail?: string;
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function place(c: Company) {
  if (c.address) return c.address;
  return [c.city, c.state].filter(Boolean).join(", ");
}

/** The same letter the API composes in services/offers.py, written here so the preview needs no send. */
export function composeOffer(c: Company, f: OfferFields): OfferDraft {
  const owner = c.owners[0];
  const greeting = owner ? `Dear ${owner},` : `To the owner of ${c.name},`;
  const cat = c.category.replaceAll("_", " ");
  const area = c.city || c.state || "your area";
  const contact = f.buyerPhone ? `reply to this email or call me at ${f.buyerPhone}` : "reply to this email";
  const ownWords = f.message?.trim() ? `\n${f.message.trim()}\n` : "";
  const signature = [f.buyerName, f.buyerEmail, f.buyerPhone].filter(Boolean).join("\n");
  const body = `${greeting}

My name is ${f.buyerName}. I came across ${c.name} at ${place(c)} and I would like to make you an offer to buy the business.

I am prepared to offer ${money(f.price)} for the business as it stands today. I arrived at that number from what is publicly known about ${c.name} (its location, its reviews, and what comparable ${cat} businesses around ${area} have sold for), so it is a starting point rather than a final word. If your books show the business is worth more, I would like to hear that.
${ownWords}
There is no obligation on your side. If you are open to a conversation, you can ${contact}. If you would rather not hear about this again, reply with the word "no" and I will not contact you further.

Thank you for your time, and for building something worth asking about.

Sincerely,
${signature}

This letter was sent through Bartr, a marketplace that helps buyers find and make offers on independently owned businesses. Bartr does not represent you and charges you nothing.
`;
  return {
    price: f.price,
    to: f.ownerEmail?.trim() || null,
    subject: `An offer for ${c.name}`,
    body,
    buyerName: f.buyerName,
    sentAt: new Date().toISOString(),
  };
}
