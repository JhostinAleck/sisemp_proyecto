import { app } from "./app";
import { migrate } from "./migrate";
import { initializeState } from "./commands";
import { ensureBootstrapInvitation } from "./access/router";
import { pool } from "./db";
if (!process.env.DATABASE_URL || !process.env.APP_ORIGIN)
  throw new Error("DATABASE_URL and APP_ORIGIN must be configured");
const origin = new URL(process.env.APP_ORIGIN);
if (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
  throw new Error("APP_ORIGIN must use HTTPS in production");
await migrate();
await initializeState();
if (process.env.BOOTSTRAP_INVITE_TOKEN)
  await ensureBootstrapInvitation(
    process.env.BOOTSTRAP_MANAGER_EMAIL || "aleckjsm@gmail.com",
    process.env.BOOTSTRAP_MANAGER_NAME || "Gerencia",
    process.env.BOOTSTRAP_INVITE_TOKEN,
  );
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, "0.0.0.0", () =>
  console.log(`Burning Bull API listening on port ${port}`),
);
let closing = false;
const stop = () => {
  if (closing) return;
  closing = true;
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
