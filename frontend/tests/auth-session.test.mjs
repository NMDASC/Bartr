import test from "node:test";
import assert from "node:assert/strict";

import { adminCredentialsMatch, isAdminIdentifier } from "../src/lib/auth/admin-accounts.ts";

const adminKeys = [
  "DEMO_ADMIN_USERNAME",
  "DEMO_ADMIN_EMAIL",
  "DEMO_ADMIN_PASSWORD",
  ...[1, 2, 3].flatMap((slot) => [
    `DEMO_ADMIN_USERNAME_${slot}`,
    `DEMO_ADMIN_EMAIL_${slot}`,
    `DEMO_ADMIN_PASSWORD_${slot}`,
  ]),
];

function setAdminEnvironment(values) {
  for (const key of adminKeys) delete process.env[key];
  Object.assign(process.env, values);
}

test.after(() => {
  for (const key of adminKeys) delete process.env[key];
});

test("matches three configured admin credentials and recognizes their identifiers", () => {
  setAdminEnvironment({
    DEMO_ADMIN_USERNAME_1: "admin",
    DEMO_ADMIN_PASSWORD_1: "alpha-password",
    DEMO_ADMIN_EMAIL_2: "ops@example.com",
    DEMO_ADMIN_PASSWORD_2: "bravo-password",
    DEMO_ADMIN_USERNAME_3: "reviewer",
    DEMO_ADMIN_PASSWORD_3: "charlie-password",
  });

  assert.equal(adminCredentialsMatch("ADMIN", "alpha-password"), true);
  assert.equal(adminCredentialsMatch("OPS@EXAMPLE.COM", "bravo-password"), true);
  assert.equal(adminCredentialsMatch("reviewer", "charlie-password"), true);
  assert.equal(isAdminIdentifier("ops@example.com"), true);
  assert.equal(isAdminIdentifier("member@example.com"), false);
  assert.equal(adminCredentialsMatch("admin", "wrong-password"), false);
});

test("keeps the legacy single-admin configuration working", () => {
  setAdminEnvironment({
    DEMO_ADMIN_EMAIL: "legacy@example.com",
    DEMO_ADMIN_PASSWORD: "legacy-password",
  });

  assert.equal(adminCredentialsMatch("legacy@example.com", "legacy-password"), true);
  assert.equal(isAdminIdentifier("admin"), false);
});
