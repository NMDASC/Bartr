/**
 * Which account a request belongs to.
 *
 * The API has no user table of its own: `X-Demo-User` IS the account, normalized
 * by `apps/api/app/identity.py` into an email, an E.164 phone or a bare name, and
 * `Engine.user` get-or-creates it with the starting cash.
 *
 * The iMessage bridge sends the sender's number, so a texted order lands on the
 * phone identity. A web session that sends its email lands on a different one,
 * with different cash and different positions. `identity.claim` cannot join them:
 * it resolves by email, and a phone identity carries no email.
 *
 * So when a session knows its number, every web request sends the number too.
 * Both transports then normalize to the same uid and there is one account.
 */

import type { AuthSession } from "./types";

/** Mirrors `_PHONE_RE` in apps/api/app/identity.py. */
const PHONE = /^\+?[0-9(][0-9 ()\-.]{6,20}$/;

/**
 * Mirrors `normalize()` in apps/api/app/identity.py for the phone branch, so a
 * number typed as `(628) 289-4567` here and delivered as `+16282894567` by the
 * gateway resolve to one uid. Returns null when the input is not a phone number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || !PHONE.test(value)) return null;
  let digits = value.replace(/[^0-9]/g, "");
  // North America when a 10 digit number arrives with no country code, which is
  // what the iMessage gateway sends for local contacts.
  if (digits.length === 10) digits = `1${digits}`;
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Pretty form for display only. Never sent as an identity. */
export function displayPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return e164;
  return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

/**
 * The identity to send as `X-Demo-User`. The number wins when present, because
 * it is the only value the iMessage bridge can produce.
 */
export function accountId(session: AuthSession | null | undefined): string | undefined {
  if (!session) return undefined;
  return session.phone || session.email || undefined;
}
