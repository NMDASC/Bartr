import { timingSafeEqual } from "node:crypto";

type AdminAccount = {
  identifier: string;
  password: string;
};

const ADMIN_SLOTS = [1, 2, 3] as const;
const DEFAULT_ADMIN_EMAIL = "admin@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "admin1234";

function envIdentifier(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value.toLowerCase();
  }
  return null;
}

function configuredSlot(slot: number): AdminAccount | null {
  const identifier = envIdentifier(
    `DEMO_ADMIN_USERNAME_${slot}`,
    `DEMO_ADMIN_EMAIL_${slot}`,
  );
  const password = process.env[`DEMO_ADMIN_PASSWORD_${slot}`];
  if (!identifier || password === undefined || password.length === 0) return null;
  return { identifier, password };
}

function hasNumberedConfiguration() {
  return ADMIN_SLOTS.some((slot) =>
    [
      `DEMO_ADMIN_USERNAME_${slot}`,
      `DEMO_ADMIN_EMAIL_${slot}`,
      `DEMO_ADMIN_PASSWORD_${slot}`,
    ].some((key) => process.env[key] !== undefined),
  );
}

function legacyAccount(): AdminAccount {
  return {
    identifier:
      envIdentifier("DEMO_ADMIN_USERNAME", "DEMO_ADMIN_EMAIL") || DEFAULT_ADMIN_EMAIL,
    password: process.env.DEMO_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
  };
}

function accounts(): AdminAccount[] {
  const candidates = hasNumberedConfiguration()
    ? ADMIN_SLOTS.map(configuredSlot).filter((account): account is AdminAccount => account !== null)
    : [legacyAccount()];

  const seen = new Set<string>();
  return candidates.filter((account) => {
    if (seen.has(account.identifier)) return false;
    seen.add(account.identifier);
    return true;
  });
}

function equalSecret(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function adminCredentialsMatch(identifier: string, password: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  let matched = false;

  for (const account of accounts()) {
    const identifierMatches = equalSecret(account.identifier, normalizedIdentifier);
    const passwordMatches = equalSecret(account.password, password);
    matched = matched || (identifierMatches && passwordMatches);
  }

  return matched;
}

export function isAdminIdentifier(identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  return accounts().some((account) => equalSecret(account.identifier, normalizedIdentifier));
}
