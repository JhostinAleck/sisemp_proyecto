import pg from 'pg';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { LocalConfig } from './dev-config';

export const databaseHelp = 'No se pudo preparar PostgreSQL local. Inicia tu servicio PostgreSQL y revisa DATABASE_URL en .env.local. Como alternativa: docker compose up -d db y usa postgresql://burning_bull:burning_bull_dev@127.0.0.1:5433/burning_bull. Consulta docs/LOCAL.md. No se modificó ninguna base remota.';

async function ensureDatabase(config: LocalConfig): Promise<void> {
  if (Buffer.byteLength(config.databaseName) > 63) throw new Error('El nombre de la base local no puede superar 63 bytes.');
  const target = new pg.Client({connectionString:config.databaseUrl, connectionTimeoutMillis:3000});
  try {
    await target.connect();
    await target.query('SELECT 1');
    return;
  } catch (error) {
    if ((error as {code?:string}).code !== '3D000') throw error;
  } finally { await target.end(); }
  const maintenanceUrl = new URL(config.databaseUrl);
  maintenanceUrl.pathname='/postgres';
  const maintenance = new pg.Client({connectionString:maintenanceUrl.href, connectionTimeoutMillis:3000});
  try {
    await maintenance.connect();
    // Database identifiers cannot be query parameters. Double quotes escape them safely.
    await maintenance.query(`CREATE DATABASE "${config.databaseName.replaceAll('"','""')}"`);
  } catch (error) {
    if ((error as {code?:string}).code !== '42P04') throw error;
  } finally { await maintenance.end(); }
}

interface LocalSecret { email:string; rawToken:string }
interface LocalAccess {email:string; url:string; expiresAt:string}

export async function prepareLocalDatabase(config: LocalConfig): Promise<LocalAccess | undefined> {
  await ensureDatabase(config);
  // These modules create a pool at import time; configuration must already be applied.
  const {migrate} = await import('../server/migrate');
  const {initializeState} = await import('../server/commands');
  const {ensureBootstrapInvitation, createInvitation} = await import('../server/access/router');
  const {pool} = await import('../server/db');
  const {tokenDigest} = await import('../server/access/crypto');
  await migrate();
  await initializeState();
  if ((await pool.query('SELECT 1 FROM users LIMIT 1')).rowCount) return;

  const database = new URL(config.databaseUrl);
  const key = createHash('sha256').update(`${database.hostname}:${database.port || '5432'}${database.pathname}:${database.username}`).digest('hex').slice(0,16);
  const privateDirectory = resolve('.secrets');
  await mkdir(privateDirectory, {recursive:true, mode:0o700});
  await chmod(privateDirectory, 0o700);
  const secretPath = resolve(privateDirectory, `local-bootstrap-${key}.json`);
  let secret: LocalSecret;
  try { secret = JSON.parse(await readFile(secretPath,'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('No se pudo leer la configuración privada local. Revisa .secrets/local-bootstrap-*.json.');
    secret = {email:config.adminEmail, rawToken:randomBytes(32).toString('base64url')};
    try { await writeFile(secretPath, JSON.stringify(secret,null,2)+'\n', {flag:'wx', mode:0o600}); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      secret = JSON.parse(await readFile(secretPath,'utf8'));
    }
  }
  await chmod(secretPath, 0o600);
  await ensureBootstrapInvitation(secret.email, 'Gerencia local', secret.rawToken);
  const result = await pool.query<{expires_at:Date; used_at:Date|null}>('SELECT expires_at,used_at FROM invitations WHERE token_hash=$1', [tokenDigest(secret.rawToken)]);
  const invitation = result.rows[0];
  if (!invitation) throw new Error('Ya existe otra invitación inicial local. Usa su enlace privado guardado; no se reemplazó automáticamente.');
  let access: LocalAccess;
  if (!invitation.used_at && invitation.expires_at.getTime() <= Date.now()) {
    const renewed = await createInvitation({email:secret.email, role:'gerencia', bootstrap:true});
    secret.rawToken = new URL(renewed.url).hash.slice('#token='.length);
    await writeFile(secretPath, JSON.stringify(secret,null,2)+'\n', {mode:0o600});
    access = {email:secret.email, ...renewed};
  } else if (invitation.used_at) {
    throw new Error('La invitación inicial local ya fue utilizada. Inicia sesión con la cuenta creada.');
  } else {
    access = {email:secret.email, url:`${config.origin}/activar#token=${encodeURIComponent(secret.rawToken)}`, expiresAt:invitation.expires_at.toISOString()};
  }
  await writeFile(resolve(privateDirectory,'local-access.json'), JSON.stringify(access,null,2)+'\n', {mode:0o600});
  await chmod(resolve(privateDirectory,'local-access.json'),0o600);
  return access;
}

export async function closeLocalDatabase(): Promise<void> {
  const {pool} = await import('../server/db');
  await pool.end();
}
