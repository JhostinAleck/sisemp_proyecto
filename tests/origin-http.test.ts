import { test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
test("the real API accepts loopback dev aliases but keeps production CSRF strict", async () => {
  process.env.APP_ORIGIN = "http://127.0.0.1:5173";
  process.env.NODE_ENV = "development";
  const { app } = await import("../server/app");
  const { pool } = await import("../server/db");
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = (server.address() as { port: number }).port;
  const logout = (origin: string) =>
    fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: "{}",
    });
  try {
    assert.equal((await logout("http://localhost:5173")).status, 200);
    assert.equal((await logout("http://127.0.0.1:5173")).status, 200);
    assert.equal((await logout("http://localhost:5174")).status, 403);
    process.env.NODE_ENV = "production";
    process.env.APP_ORIGIN = "https://burning-bull-sisemp-jhostin.vercel.app";
    assert.equal((await logout("http://localhost:5173")).status, 403);
    assert.equal(
      (await logout("https://burning-bull-sisemp-jhostin.vercel.app")).status,
      200,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    await pool.end();
  }
});
