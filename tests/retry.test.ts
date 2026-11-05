import { test } from "node:test";
import assert from "node:assert/strict";
import { CommandRetry } from "../src/app/retry";
function helper() {
  let n = 0;
  return new CommandRetry(() => `key-${++n}`);
}
const receipt = {
  type: "inventory.receive",
  itemId: "item",
  qty: 2,
  notes: "",
};
test("lost reply and 5xx reuse the original receipt identity", () => {
  const r = helper(),
    key = r.next("user", receipt);
  r.settle();
  assert.equal(r.next("user", receipt), key);
  r.settle(503);
  assert.equal(r.next("user", receipt), key);
});
test("successful response permits a separate subsequent identical receipt", () => {
  const r = helper(),
    key = r.next("user", receipt);
  r.settle(200);
  assert.notEqual(r.next("user", receipt), key);
});
test("definitive validation failure discards the retry identity", () => {
  const r = helper(),
    key = r.next("user", receipt);
  r.settle(422);
  assert.notEqual(r.next("user", receipt), key);
});
test("different account or payload cannot inherit an ambiguous command key", () => {
  const r = helper(),
    key = r.next("user", receipt);
  assert.notEqual(r.next("other", receipt), key);
  const next = r.next("user", receipt);
  assert.notEqual(r.next("user", { ...receipt, qty: 3 }), next);
});
test("logout and expired session discard unresolved request identity", () => {
  const r = helper(),
    key = r.next("user", receipt);
  r.reset();
  assert.notEqual(r.next("user", receipt), key);
});
