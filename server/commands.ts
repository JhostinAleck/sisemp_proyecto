import { createHash, randomUUID } from "node:crypto";
import { pool } from "./db";
import { applyCommand } from "../src/domains/shared/commands";
import { seedWorkspace } from "../src/domains/shared/seed";
import { ensure } from "../src/domains/shared/errors";
import { readSessionCookie } from "./access/security";
import { tokenDigest } from "./access/crypto";
import type {
  Command,
  CommandResult,
  User,
  Workspace,
} from "../src/domains/shared/types";
export async function initializeState(): Promise<void> {
  await pool.query(
    "INSERT INTO app_state(id,data)VALUES('main',$1)ON CONFLICT(id)DO NOTHING",
    [JSON.stringify(seedWorkspace())],
  );
}
/** State lock + session/user locks make permission checks and inventory writes one transaction. */
export async function runCommand(
  cookie: string | undefined,
  command: Command,
  requestId: string,
): Promise<CommandResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const token = readSessionCookie(cookie);
    ensure(token, "Inicia sesión para continuar", 401);
    const actor = (
      await client.query<User>(
        "SELECT u.id,u.name,u.email,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true FOR SHARE OF u,s",
        [tokenDigest(token)],
      )
    ).rows[0];
    ensure(actor, "La sesión venció o la cuenta fue desactivada", 401);
    const row = (
      await client.query<{ data: Workspace; version: string }>(
        "SELECT data,version FROM app_state WHERE id='main' FOR UPDATE",
      )
    ).rows[0];
    ensure(row, "El espacio de trabajo no está disponible", 503);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(command))
      .digest("hex");
    const old = (
      await client.query<{
        fingerprint: string;
        summary: string;
        entity_id: string;
      }>(
        "SELECT fingerprint,summary,entity_id FROM command_requests WHERE user_id=$1 AND request_id=$2",
        [actor.id, requestId],
      )
    ).rows[0];
    if (old) {
      ensure(
        old.fingerprint === fingerprint,
        "El identificador de la operación ya se usó para otra solicitud",
        409,
      );
      await client.query("COMMIT");
      return {
        state: row.data,
        version: Number(row.version),
        user: actor,
        summary: old.summary,
        entityId: old.entity_id,
      };
    }
    const result = applyCommand(row.data, actor, command);
    const version = Number(row.version) + 1;
    await client.query(
      "UPDATE app_state SET data=$1,version=$2,updated_at=now()WHERE id='main'",
      [JSON.stringify(result.state), version],
    );
    await client.query(
      "INSERT INTO audit_events(id,actor_id,action,entity_id,summary)VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), actor.id, command.type, result.entityId, result.summary],
    );
    await client.query(
      "INSERT INTO command_requests(user_id,request_id,fingerprint,summary,entity_id)VALUES($1,$2,$3,$4,$5)",
      [actor.id, requestId, fingerprint, result.summary, result.entityId],
    );
    await client.query("COMMIT");
    return { ...result, version, user: actor };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
