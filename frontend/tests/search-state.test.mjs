import test from "node:test";
import assert from "node:assert/strict";
import { initialSearchState, reduceDiscovery } from "../src/lib/search-state.ts";

const company = { _id: "test", name: "Laundry", status: "ready", relevance: { rank: 1 } };

test("replayed stubs cannot erase a ready company's ranking", () => {
  let state = reduceDiscovery(initialSearchState(), { type: "ranking", revision: 2, companies: [company] });
  state = reduceDiscovery(state, { type: "company_stub", company: { ...company, status: "stub" } });
  state = reduceDiscovery(state, { type: "company_ready", company: { _id: "test", name: "Laundry", status: "ready" } });
  state = reduceDiscovery(state, { type: "ranking", revision: 1, companies: [] });
  assert.equal(state.cards.get("test").status, "ready");
  assert.equal(state.cards.get("test").relevance.rank, 1);
  assert.deepEqual(state.order, ["test"]);
});

test("completion resolves unfinished rows and preserves usable results", () => {
  let state = reduceDiscovery(initialSearchState(), { type: "ranking", revision: 1, companies: [company, { _id: "pending", status: "stub" }] });
  state = reduceDiscovery(state, { type: "done", total: 1 });
  assert.equal(state.phase, "partial");
  assert.equal(state.cards.get("pending").status, "failed");
  assert.equal(state.cards.get("test").status, "ready");
});

test("provider warnings distinguish partial results from a successful empty search", () => {
  const partial = reduceDiscovery(initialSearchState(), { type: "done", total: 0, warnings: ["Live search unavailable"] });
  assert.equal(partial.phase, "partial");
  const empty = reduceDiscovery(initialSearchState(), { type: "done", total: 0, status: "done" });
  assert.equal(empty.phase, "done");
});

test("terminal done cannot hide an earlier error and retry clears stale state", () => {
  let state = reduceDiscovery(initialSearchState(), { type: "error", message: "Connection lost" });
  state = reduceDiscovery(state, { type: "done", total: 0 });
  assert.equal(state.phase, "error");
  assert.equal(state.error, "Connection lost");
  state = reduceDiscovery(state, { type: "reset" });
  assert.equal(state.phase, "streaming");
  assert.equal(state.error, null);
  assert.equal(state.cards.size, 0);
});
