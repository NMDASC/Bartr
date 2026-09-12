import test from "node:test";
import assert from "node:assert/strict";

import { clearSavedSearch, initialSearchState, readSavedSearch, reduceDiscovery, writeSavedSearch } from "../src/lib/search-state.ts";

const store = new Map();
globalThis.window = {
  sessionStorage: {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
};
const company = { _id: "c1", name: "Laundry", status: "ready" };

test("a finished search comes back final: no stream on Back", () => {
  let state = reduceDiscovery(initialSearchState(), { type: "nocache" });
  state = reduceDiscovery(state, { type: "job", jobId: "job_1" });
  state = reduceDiscovery(state, { type: "ranking", revision: 1, companies: [company] });
  state = reduceDiscovery(state, { type: "done", total: 1 });
  writeSavedSearch("laundromat in denver", "me", state);
  const back = readSavedSearch("Laundromat in Denver ", "ME");
  assert.equal(back.phase, "done");
  assert.equal(back.restored, true);
  assert.equal(back.hydrated, true);
  assert.equal(back.cards.get("c1").name, "Laundry");
  assert.equal(back.jobId, "job_1");
});

test("a search still running comes back with its job so the page reattaches", () => {
  let state = reduceDiscovery(initialSearchState(), { type: "nocache" });
  state = reduceDiscovery(state, { type: "job", jobId: "job_2" });
  state = reduceDiscovery(state, { type: "ranking", revision: 1, companies: [company] });
  writeSavedSearch("pizza in denver", "me", state);
  const back = readSavedSearch("pizza in denver", "me");
  assert.equal(back.phase, "streaming");
  assert.equal(back.restored, false);
  assert.equal(back.jobId, "job_2");
  assert.equal(back.cards.size, 1);
});

test("nothing saved means a fresh stream, and clearing forgets a search", () => {
  assert.equal(readSavedSearch("nothing here", "me"), null);
  clearSavedSearch("pizza in denver", "me");
  assert.equal(readSavedSearch("pizza in denver", "me"), null);
});

test("a replayed job stream cannot double-add cards or roll back a ranking", () => {
  let state = reduceDiscovery(initialSearchState(), { type: "nocache" });
  const events = [
    { type: "ranking", revision: 1, companies: [company] },
    { type: "company_ready", company },
    { type: "status", phase: "sourcing", message: "x", t: 1 },
  ];
  for (const e of events) state = reduceDiscovery(state, e);
  for (const e of events) state = reduceDiscovery(state, e);
  assert.deepEqual(state.order, ["c1"]);
  assert.equal(state.cards.size, 1);
});
