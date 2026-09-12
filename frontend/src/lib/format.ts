/** Formatting helpers. Everything numeric on screen goes through here so units stay honest. */

export function usd(n: number | null | undefined, opts: { compact?: boolean; cents?: boolean } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "\u2014";
  const { compact = false, cents = true } = opts;
  if (compact) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

/** Per share price. Always two decimals, no currency symbol, for ledger columns. */
export function px(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "\u2014";
  return n.toFixed(2);
}

export function qty(n: number | null | undefined) {
  if (n === null || n === undefined) return "\u2014";
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

export function pct(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined) return "\u2014";
  return `${(n * 100).toFixed(digits)}%`;
}

export function signed(n: number, digits = 2) {
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}

/** Whole-company value from a per-share price. */
export function companyValue(perShare: number | null | undefined, shares = 10000) {
  if (perShare === null || perShare === undefined) return null;
  return perShare * shares;
}

export function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function clock(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function secondsUntil(iso: string, now = Date.now()) {
  return Math.max(0, (Date.parse(iso) - now) / 1000);
}
