import type { Participant, Side } from "@contracts/types";

/** Stable seat number from a hash. Never a name. */
export function bidderSeat(uidHash: string) {
  let n = 0;
  for (let i = 0; i < uidHash.length; i += 1) n = (n * 31 + uidHash.charCodeAt(i)) % 84;
  return n + 1;
}

export function bidderLabel(p: Pick<Participant, "alias" | "uid_hash">, you: string | null) {
  if (p.alias === "Owner") return "Owner";
  if (you && p.uid_hash === you) return "You";
  return `Bidder ${bidderSeat(p.uid_hash)}`;
}

export function bidderInitials(label: string) {
  if (label === "Owner") return "OW";
  if (label === "You") return "YOU";
  const n = label.replace(/\D/g, "");
  return n ? `B${n}` : "B";
}

export function sideVerb(side: Side) {
  return side === "buy" ? "bidding" : "offering";
}
