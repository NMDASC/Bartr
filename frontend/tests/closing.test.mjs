import test from "node:test";
import assert from "node:assert/strict";

import {
  allSigned,
  closedHref,
  closingHref,
  dealFromParams,
  detectWins,
  documentsFor,
  headline,
  sign,
  signatureRef,
} from "../src/lib/closing.ts";

const company = {
  _id: "co_squirrel_hill_wash",
  name: "Squirrel Hill Wash and Fold",
  city: "Pittsburgh",
  state: "PA",
  market: { shares_outstanding: 10000 },
};
const buyer = { name: "Vir Toolsidass", email: "vir@example.com" };

test("a cleared order becomes a share deal with the right size and fraction", () => {
  const deal = dealFromParams(company, new URLSearchParams("qty=50&price=57.2&order=ord_1&round=3"));
  assert.equal(deal.kind, "shares");
  assert.equal(deal.qty, 50);
  assert.equal(deal.total, 2860);
  assert.equal(deal.pct, 0.005);
  assert.equal(deal.orderId, "ord_1");
  assert.equal(deal.round, 3);
});

test("a whole-company purchase covers every share", () => {
  const deal = dealFromParams(company, new URLSearchParams("whole=1&price=560000"));
  assert.equal(deal.kind, "whole");
  assert.equal(deal.qty, 10000);
  assert.equal(deal.pct, 1);
  assert.equal(deal.total, 560000);
});

test("bad or missing figures produce no deal", () => {
  assert.equal(dealFromParams(company, new URLSearchParams("qty=50")), null);
  assert.equal(dealFromParams(company, new URLSearchParams("qty=0&price=10")), null);
  assert.equal(dealFromParams(company, new URLSearchParams("price=-4&whole=1")), null);
});

test("closing and closed links carry the deal and round-trip through the parser", () => {
  const href = closingHref("co_x", { kind: "shares", qty: 50, price: 57.2, orderId: "ord_9", round: 2 });
  assert.equal(href, "/company/co_x/closing?price=57.2&qty=50&order=ord_9&round=2");
  const parsed = dealFromParams(company, new URLSearchParams(href.split("?")[1]));
  assert.equal(parsed.qty, 50);
  assert.equal(parsed.orderId, "ord_9");
  const whole = closingHref("co_x", { kind: "whole", qty: 10000, price: 560000 });
  assert.equal(whole, "/company/co_x/closing?price=560000&whole=1");
  const deal = dealFromParams(company, new URLSearchParams("qty=50&price=57.2"));
  assert.equal(closedHref("co_x", deal), "/company/co_x/closed?price=57.2&qty=50");
});

test("only orders placed on this page count as wins, and only once they fill", () => {
  const orders = [
    { _id: "ord_a", filled_qty: 0, status: "open" },
    { _id: "ord_b", filled_qty: 50, status: "filled" },
    { _id: "ord_c", filled_qty: 20, status: "partial" },
    { _id: "ord_old", filled_qty: 10, status: "filled" },
  ];
  const wins = detectWins(["ord_a", "ord_b", "ord_c"], orders);
  assert.deepEqual(wins.map((o) => o._id), ["ord_b", "ord_c"]);
  assert.deepEqual(detectWins([], orders), []);
});

test("share papers name the buyer, the shares, the fraction and the money", () => {
  const deal = dealFromParams(company, new URLSearchParams("qty=50&price=57.2&order=ord_1&round=3"));
  const docs = documentsFor(deal, buyer, "2026-09-12T19:00:00Z");
  assert.deepEqual(docs.map((d) => d.id), ["share-transfer", "holder-letter"]);
  const text = docs.flatMap((d) => d.sections.map((s) => s.text)).join("\n");
  assert.match(text, /Vir Toolsidass/);
  assert.match(text, /50 shares of Squirrel Hill Wash and Fold/);
  assert.match(text, /0\.50% of the company/);
  assert.match(text, /\$57\.20 per share/);
  assert.match(text, /\$2,860\.00/);
  assert.match(text, /round 3/);
  assert.match(text, /ord_1/);
  assert.match(text, /State of PA/);
  assert.doesNotMatch(text, /undefined|NaN|null/);
});

test("whole-company papers are the purchase agreement and the bill of sale", () => {
  const deal = dealFromParams(company, new URLSearchParams("whole=1&price=560000"));
  const docs = documentsFor(deal, buyer, "2026-09-12T19:00:00Z");
  assert.deepEqual(docs.map((d) => d.id), ["apa", "bill-of-sale"]);
  const text = docs.flatMap((d) => d.sections.map((s) => s.text)).join("\n");
  assert.match(text, /\$560,000/);
  assert.match(text, /September 12, 2026/);
  assert.doesNotMatch(text, /undefined|NaN|null/);
});

test("signing is per document, deterministic, and complete only when every paper is signed", () => {
  const deal = dealFromParams(company, new URLSearchParams("qty=50&price=57.2"));
  const docs = documentsFor(deal, buyer);
  const at = "2026-09-12T19:00:00Z";
  const first = sign(docs[0], buyer.name, at);
  assert.equal(first.documentId, "share-transfer");
  assert.equal(first.ref, signatureRef("share-transfer", buyer.name, at));
  assert.match(first.ref, /^BTR-[0-9A-F]{8}$/);
  assert.notEqual(first.ref, sign(docs[1], buyer.name, at).ref);
  assert.equal(allSigned(docs, [first]), false);
  assert.equal(allSigned(docs, [first, sign(docs[1], buyer.name, at)]), true);
  assert.equal(allSigned([], []), false);
});

test("the celebration headline matches the kind of purchase", () => {
  assert.equal(headline(dealFromParams(company, new URLSearchParams("qty=1&price=1"))), "Congrats, you just bought a piece of Squirrel Hill Wash and Fold.");
  assert.equal(headline(dealFromParams(company, new URLSearchParams("whole=1&price=1"))), "Congrats, you just bought Squirrel Hill Wash and Fold.");
});
