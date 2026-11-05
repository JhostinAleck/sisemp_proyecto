import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../server/access/origin";
test("development accepts localhost and IPv4 loopback on the configured frontend port", () => {
  assert.equal(
    isAllowedOrigin(
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "development",
    ),
    true,
  );
  assert.equal(
    isAllowedOrigin(
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "development",
    ),
    true,
  );
});
test("development aliases cannot bypass the configured protocol, port, or loopback host", () => {
  for (const origin of [
    "http://localhost:5174",
    "https://localhost:5173",
    "http://localhost.evil.test:5173",
    "http://evil.test:5173",
    "null",
    "http://localhost:5173/path",
  ])
    assert.equal(
      isAllowedOrigin(origin, "http://localhost:5173", "development"),
      false,
    );
  assert.equal(
    isAllowedOrigin(
      "http://localhost:5173",
      "https://burning-bull-sisemp-jhostin.vercel.app",
      "development",
    ),
    false,
  );
});
test("production keeps exact-origin enforcement and rejects loopback aliases", () => {
  const origin = "https://burning-bull-sisemp-jhostin.vercel.app";
  assert.equal(isAllowedOrigin(origin, origin, "production"), true);
  assert.equal(
    isAllowedOrigin("http://localhost:5173", origin, "production"),
    false,
  );
  assert.equal(
    isAllowedOrigin(
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "production",
    ),
    false,
  );
  assert.equal(isAllowedOrigin(undefined, origin, "production"), false);
});
