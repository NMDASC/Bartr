import { test } from "node:test";
import assert from "node:assert/strict";
import { jbClient } from "../src/jb.ts";

test("an unconfigured bridge never claims to place an order", async () => {
  const client = jbClient({ log: () => {} });
  const result = await client.chat("+12025550100", "buy 10 shares");
  assert.equal(client.mode, "offline");
  assert.match(result.content, /No order has been placed/);
});

test("the bridge forwards identity, authentication and delivery ID to the shared agent", async (t) => {
  let captured;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    captured = { url, ...init, body: JSON.parse(init.body) };
    return Response.json({ role: "assistant", content: "Your order is pending.", tool_calls: [] });
  });
  const client = jbClient({ apiUrl: "http://localhost:8000/", bridgeToken: "test-token", log: () => {} });
  const result = await client.chat("+12025550100", "my orders", "delivery-123");
  assert.equal(captured.url, "http://localhost:8000/api/v1/agent/chat");
  assert.equal(captured.headers["x-demo-user"], "+12025550100");
  assert.equal(captured.headers["x-bridge-token"], "test-token");
  assert.equal(captured.body.request_id, "delivery-123");
  assert.equal(result.content, "Your order is pending.");
});

test("a rejected API request is surfaced instead of a fabricated success", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("denied", {status:403}));
  const client = jbClient({ apiUrl: "http://localhost:8000", log: () => {} });
  await assert.rejects(client.chat("user", "my orders"), /403/);
});
