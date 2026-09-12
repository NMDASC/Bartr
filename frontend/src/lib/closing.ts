import type { Company, Order } from "@contracts/types";

export type DealKind = "shares" | "whole";

export interface Deal {
  kind: DealKind;
  companyId: string;
  companyName: string;
  place: string;
  state: string | null;
  sharesOutstanding: number;
  /** shares bought; equals sharesOutstanding for a whole-company purchase */
  qty: number;
  /** per share for shares, the whole price for a whole-company purchase */
  price: number;
  total: number;
  /** fraction of the company, 0..1 */
  pct: number;
  orderId: string | null;
  round: number | null;
}

export interface Buyer {
  name: string;
  email: string;
}

export interface ClosingSection {
  heading: string;
  text: string;
}

export interface ClosingDocument {
  id: string;
  title: string;
  counterparty: string;
  sections: ClosingSection[];
}

export interface Signature {
  documentId: string;
  signer: string;
  at: string;
  ref: string;
}

export const DEFAULT_SHARES = 10_000;

export function dealFromParams(company: Company, params: URLSearchParams): Deal | null {
  const shares = company.market?.shares_outstanding ?? DEFAULT_SHARES;
  const place = [company.city, company.state].filter(Boolean).join(", ");
  const price = Number(params.get("price"));
  if (!Number.isFinite(price) || price <= 0) return null;
  const base = {
    companyId: company._id,
    companyName: company.name,
    place,
    state: company.state ?? null,
    sharesOutstanding: shares,
    orderId: params.get("order"),
    round: params.get("round") ? Number(params.get("round")) : null,
  };
  if (params.get("whole") === "1") {
    return { ...base, kind: "whole", qty: shares, price, total: price, pct: 1 };
  }
  const qty = Number(params.get("qty"));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return {
    ...base,
    kind: "shares",
    qty,
    price,
    total: Math.round(qty * price * 100) / 100,
    pct: Math.min(1, qty / shares),
  };
}

export function closingHref(companyId: string, deal: Pick<Deal, "kind" | "qty" | "price"> & { orderId?: string | null; round?: number | null }) {
  const params = new URLSearchParams();
  params.set("price", String(deal.price));
  if (deal.kind === "whole") {
    params.set("whole", "1");
  } else {
    params.set("qty", String(deal.qty));
    if (deal.orderId) params.set("order", deal.orderId);
    if (deal.round) params.set("round", String(deal.round));
  }
  return `/company/${companyId}/closing?${params}`;
}

export function closedHref(companyId: string, deal: Deal) {
  return closingHref(companyId, deal).replace("/closing?", "/closed?");
}

/** Orders the ticket placed on this page that have since filled, in whole or in part. */
export function detectWins(tracked: Iterable<string>, orders: Order[]): Order[] {
  const ids = new Set(tracked);
  return orders.filter((o) => ids.has(o._id) && o.filled_qty > 0);
}

function money(n: number, cents = true) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

function pctText(p: number) {
  const v = p * 100;
  return `${v >= 10 ? v.toFixed(1) : v.toFixed(2)}%`;
}

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** The papers for this deal. Fields are filled from the cleared order, nothing is left blank. */
export function documentsFor(deal: Deal, buyer: Buyer, at = new Date().toISOString()): ClosingDocument[] {
  const date = longDate(at);
  const law = deal.state ? `the Commonwealth or State of ${deal.state}` : "the State of Delaware";
  const seller = `the holders of ${deal.companyName} whose sell orders cleared${deal.round ? ` in round ${deal.round}` : ""} on the Bartr exchange, represented by the Bartr Treasury`;

  if (deal.kind === "whole") {
    return [
      {
        id: "apa",
        title: "Asset Purchase Agreement",
        counterparty: `The owner of ${deal.companyName}`,
        sections: [
          {
            heading: "Parties",
            text: `This Asset Purchase Agreement is made on ${date} between the owner of ${deal.companyName}, ${deal.place} (the Seller) and ${buyer.name}, ${buyer.email} (the Buyer).`,
          },
          {
            heading: "1. Sale of the business",
            text: `The Seller sells and the Buyer purchases substantially all of the assets used in the operation of ${deal.companyName}, including equipment, inventory, customer lists, trade names, goodwill, and the benefit of all leases and contracts the Buyer elects to assume.`,
          },
          {
            heading: "2. Purchase price",
            text: `The purchase price is ${money(deal.price, false)}, payable at closing from the Buyer's Bartr cash balance. The price was set against the Bartr appraisal in effect on ${date} and is not subject to adjustment except for a customary working capital true-up within 60 days of closing.`,
          },
          {
            heading: "3. Closing",
            text: `Closing takes place on ${date} on the Bartr platform. Title to the purchased assets passes to the Buyer on execution of the Bill of Sale delivered with this Agreement.`,
          },
          {
            heading: "4. Representations",
            text: `The Seller represents that it owns the purchased assets free of liens, that the business has been operated in the ordinary course, and that the financial evidence supplied to Bartr is accurate in all material respects. The Buyer represents that it has the funds to close and has completed the diligence it considers necessary.`,
          },
          {
            heading: "5. Governing law and signatures",
            text: `This Agreement is governed by the laws of ${law}. It may be signed electronically and in counterparts, each of which is an original.`,
          },
        ],
      },
      {
        id: "bill-of-sale",
        title: "Bill of Sale and Assignment",
        counterparty: `The owner of ${deal.companyName}`,
        sections: [
          {
            heading: "Transfer",
            text: `For the consideration stated in the Asset Purchase Agreement dated ${date}, the owner of ${deal.companyName} conveys to ${buyer.name} all right, title and interest in the purchased assets, and assigns the assumed contracts and leases, effective on the date of the last signature below.`,
          },
          {
            heading: "Further assurances",
            text: `The Seller will sign any further instrument reasonably required to vest the purchased assets in the Buyer, including transfers of registrations, permits and domain names.`,
          },
        ],
      },
    ];
  }

  return [
    {
      id: "share-transfer",
      title: "Share Transfer Agreement",
      counterparty: "Bartr Treasury for the selling holders",
      sections: [
        {
          heading: "Parties",
          text: `This Share Transfer Agreement is made on ${date} between ${seller} (the Transferor) and ${buyer.name}, ${buyer.email} (the Transferee).`,
        },
        {
          heading: "1. Shares transferred",
          text: `The Transferor transfers to the Transferee ${deal.qty.toLocaleString("en-US")} shares of ${deal.companyName}, ${deal.place}, out of ${deal.sharesOutstanding.toLocaleString("en-US")} shares outstanding, being ${pctText(deal.pct)} of the company.`,
        },
        {
          heading: "2. Consideration",
          text: `The price is ${money(deal.price)} per share, the uniform clearing price of the round in which the Transferee's order${deal.orderId ? ` ${deal.orderId}` : ""} filled, for a total of ${money(deal.total)}. The total is settled from the Transferee's Bartr cash balance at clearing.`,
        },
        {
          heading: "3. Title and register",
          text: `Title passes on clearing. Bartr updates the register of holders of ${deal.companyName} to record the Transferee's holding, and the Transferee's portfolio reflects the shares from that moment.`,
        },
        {
          heading: "4. Representations",
          text: `The Transferor represents that the shares are transferred free of liens. The Transferee represents that it placed the order for its own account, has read the appraisal on file, and understands that the shares trade only on the Bartr exchange in timed rounds.`,
        },
        {
          heading: "5. Governing law and signatures",
          text: `This Agreement is governed by the laws of ${law}. It may be signed electronically and in counterparts.`,
        },
      ],
    },
    {
      id: "holder-letter",
      title: "Holder Representation Letter",
      counterparty: `${deal.companyName} and Bartr`,
      sections: [
        {
          heading: "Confirmation",
          text: `${buyer.name} confirms the purchase of ${deal.qty.toLocaleString("en-US")} shares of ${deal.companyName} for ${money(deal.total)} on ${date}, and that the funds used were the Transferee's own.`,
        },
        {
          heading: "Acknowledgements",
          text: `The holder acknowledges that the appraisal on file is an estimate built from public evidence and model opinions, that the value of the shares moves with each cleared round, and that the owner's buyback floor and float ladder are quotes, not guarantees of liquidity.`,
        },
      ],
    },
  ];
}

/** Short stable reference for a signature, so the same signing produces the same mark in tests. */
export function signatureRef(documentId: string, signer: string, at: string) {
  let h = 0x811c9dc5;
  for (const ch of `${documentId}|${signer}|${at}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `BTR-${h.toString(16).padStart(8, "0").toUpperCase()}`;
}

export function sign(document: ClosingDocument, signer: string, at = new Date().toISOString()): Signature {
  return { documentId: document.id, signer, at, ref: signatureRef(document.id, signer, at) };
}

export function allSigned(documents: ClosingDocument[], signatures: Signature[]) {
  const signed = new Set(signatures.map((s) => s.documentId));
  return documents.length > 0 && documents.every((d) => signed.has(d.id));
}

export function headline(deal: Deal) {
  return deal.kind === "whole"
    ? `Congrats, you just bought ${deal.companyName}.`
    : `Congrats, you just bought a piece of ${deal.companyName}.`;
}
