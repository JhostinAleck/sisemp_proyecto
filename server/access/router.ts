import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, RequestHandler, Response } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../db';
import type { Role, User } from '../../src/domains/shared/types';
import { hashPassword, newToken, tokenDigest, verifyPassword } from './crypto';
import { HttpError } from './errors';
import { assertLiveToken, assertManager, assertManagerChange, readSessionCookie, sessionCookie } from './security';

const roleSchema = z.enum(['produccion','bodega','compras','gerencia']);
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(12).max(128);
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const userColumns = 'id,name,email,role,active';
const loginFailure = 'No se pudo iniciar sesión. Revisa tus credenciales o inténtalo más tarde.';
// Same scrypt work for missing accounts; never issue a session using this digest.
const dummyHash = `scrypt$32768$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function audit(client: PoolClient, actor: string | null, action: string, entityId: string, summary: string): Promise<void> {
  await client.query('INSERT INTO audit_events(id,actor_id,action,entity_id,summary) VALUES($1,$2,$3,$4,$5)', [randomUUID(),actor,action,entityId,summary]);
}
async function currentUser(req: Request): Promise<User | undefined> {
  const token = readSessionCookie(req.headers.cookie);
  if (!token || !tokenSchema.safeParse(token).success) return undefined;
  const result = await pool.query<User>(`SELECT u.id,u.name,u.email,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`, [tokenDigest(token)]);
  return result.rows[0];
}
export const requireUser: RequestHandler = async (req, res, next) => {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, 'Inicia sesión para continuar.');
  res.locals.user = user;
  next();
};
const requireManager: RequestHandler = (_req, res, next) => { assertManager(res.locals.user as User); next(); };
async function lockManager(client: PoolClient, id: string): Promise<User> {
  // A single lock orders membership changes, including simultaneous demotions by two managers.
  await client.query('SELECT pg_advisory_xact_lock(84537012)');
  const user = (await client.query<User>(`SELECT ${userColumns} FROM users WHERE id=$1 FOR UPDATE`, [id])).rows[0];
  if (!user) throw new HttpError(403, 'Esta acción requiere gerencia.');
  assertManager(user); return user;
}
async function addSession(client: PoolClient, userId: string): Promise<string> {
  const token = newToken();
  await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')", [tokenDigest(token),userId]);
  return token;
}
function setSession(res: Response, token: string): void { res.setHeader('Set-Cookie', sessionCookie(token)); }

export interface InvitationInput { email:string; role:Role; createdBy?:string; bootstrap?:boolean }
export async function createInvitation(input: InvitationInput): Promise<{url:string;expiresAt:string}> {
  const email = emailSchema.parse(input.email);
  const role = roleSchema.parse(input.role);
  if (!process.env.APP_ORIGIN) throw new Error('APP_ORIGIN is required to create invitation links');
  const origin = new URL(process.env.APP_ORIGIN).origin;
  return transaction(async client => {
    if (input.bootstrap) {
      await client.query('SELECT pg_advisory_xact_lock(84537012)');
      if (role !== 'gerencia' || (await client.query('SELECT 1 FROM users LIMIT 1')).rowCount) throw new HttpError(409, 'La cuenta inicial ya fue configurada.');
    } else {
      if (!input.createdBy) throw new HttpError(403, 'Esta acción requiere gerencia.');
      await lockManager(client,input.createdBy);
    }
    if ((await client.query('SELECT 1 FROM users WHERE email=$1', [email])).rowCount) throw new HttpError(409, 'Ese correo ya tiene una cuenta.');
    // Reissuing an invite invalidates previous links for this address.
    if (input.bootstrap) await client.query('UPDATE invitations SET used_at=now() WHERE used_at IS NULL');
    else await client.query('UPDATE invitations SET used_at=now() WHERE email=$1 AND used_at IS NULL',[email]);
    const token = newToken(); const id = randomUUID();
    const result = await client.query<{expires_at:Date}>("INSERT INTO invitations(id,token_hash,email,role,created_by,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days') RETURNING expires_at", [id,tokenDigest(token),email,role,input.createdBy ?? null]);
    await audit(client,input.createdBy ?? null,'access.invite',id,`Invitación creada para ${email} (${role})`);
    return {url:`${origin}/activar#token=${encodeURIComponent(token)}`,expiresAt:result.rows[0].expires_at.toISOString()};
  });
}

// Reserve both counters before password work; concurrent attempts cannot bypass either limit.
async function reserveAttempts(counters: readonly (readonly [string,number])[]): Promise<boolean> {
  return transaction(async client => {
    let allowed = true;
    for (const [key,limit] of counters) {
      const result = await client.query<{attempts:number}>(`INSERT INTO auth_limits(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_limits.expires_at<=now() THEN 1 ELSE auth_limits.attempts+1 END,expires_at=CASE WHEN auth_limits.expires_at<=now() THEN now()+interval '15 minutes' ELSE auth_limits.expires_at END RETURNING attempts`,[key]);
      allowed = allowed && result.rows[0].attempts <= limit;
    }
    return allowed;
  });
}

/** Deployment bootstrap is idempotent: it never rotates, revives, or replaces a previous link. */
export async function ensureBootstrapInvitation(email:string, name:string, rawToken:string): Promise<{created:boolean}> {
  email = emailSchema.parse(email);
  z.string().trim().min(1).max(120).parse(name); // The member chooses their final display name during activation.
  tokenSchema.parse(rawToken);
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(84537012)');
    if ((await client.query('SELECT 1 FROM users LIMIT 1')).rowCount || (await client.query('SELECT 1 FROM invitations WHERE created_by IS NULL LIMIT 1')).rowCount) return {created:false};
    const id = randomUUID();
    await client.query("INSERT INTO invitations(id,token_hash,email,role,expires_at) VALUES($1,$2,$3,'gerencia',now()+interval '7 days')",[id,tokenDigest(rawToken),email]);
    await audit(client,null,'access.bootstrap',id,'Invitación inicial de gerencia creada');
    return {created:true};
  });
}

export const authRouter = Router();
authRouter.use((_req,res,next) => { res.setHeader('Cache-Control','no-store'); next(); });
authRouter.get('/session', async (req,res) => { res.json({user:await currentUser(req) ?? null}); });
authRouter.post('/login', async (req,res) => {
  const parsed = z.object({email:emailSchema,password:z.string().min(1).max(128)}).safeParse(req.body);
  if (!parsed.success) throw new HttpError(401,loginFailure);
  const {email,password} = parsed.data;
  if (!await reserveAttempts([[`email:${tokenDigest(email)}`,10],[`ip:${tokenDigest(req.ip ?? req.socket.remoteAddress ?? 'unknown')}`,50]])) throw new HttpError(429,loginFailure);
  const record = (await pool.query<User & {password_hash:string}>(`SELECT ${userColumns},password_hash FROM users WHERE email=$1`,[email])).rows[0];
  const verified = await verifyPassword(password,record?.password_hash ?? dummyHash);
  if (!verified || !record?.active) throw new HttpError(401,loginFailure);
  const result = await transaction(async client => {
    // Serialize login against password changes and disable operations.
    const fresh = (await client.query<User & {password_hash:string}>(`SELECT ${userColumns},password_hash FROM users WHERE id=$1 FOR UPDATE`,[record.id])).rows[0];
    if (!fresh?.active || fresh.password_hash !== record.password_hash) throw new HttpError(401,loginFailure);
    const token = await addSession(client,fresh.id);
    await audit(client,fresh.id,'access.login',fresh.id,'Inicio de sesión');
    const {password_hash: _hash, ...user} = fresh;
    return {token,user};
  });
  setSession(res,result.token); res.json({user:result.user});
});
authRouter.post('/logout', async (req,res) => {
  const token = readSessionCookie(req.headers.cookie);
  if (token && token.length <= 128) await pool.query('DELETE FROM sessions WHERE token_hash=$1',[tokenDigest(token)]);
  setSession(res,''); res.json({ok:true});
});
authRouter.get('/invitation', async (req,res) => {
  const token = tokenSchema.parse(req.query.token);
  const record = (await pool.query('SELECT email,role,expires_at,used_at FROM invitations WHERE token_hash=$1',[tokenDigest(token)])).rows[0];
  assertLiveToken(record); res.json({email:record.email,role:record.role,expiresAt:record.expires_at.toISOString()});
});
authRouter.post('/activate', async (req,res) => {
  const {token,name,password} = z.object({token:tokenSchema,name:z.string().trim().min(1).max(120),password:passwordSchema}).strict().parse(req.body);
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  if (!await reserveAttempts([[`activate:ip:${tokenDigest(ip)}`,10]])) throw new HttpError(429,'Demasiados intentos de activación. Inténtalo más tarde.');
  // Reject arbitrary bearer tokens before any expensive password work. The transaction rechecks expiry/use below.
  const preflight = (await pool.query('SELECT expires_at,used_at FROM invitations WHERE token_hash=$1',[tokenDigest(token)])).rows[0];
  assertLiveToken(preflight);
  const passwordHash = await hashPassword(password);
  const result = await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(84537012)');
    const invitation = (await client.query('SELECT id,email,role,expires_at,used_at FROM invitations WHERE token_hash=$1 FOR UPDATE',[tokenDigest(token)])).rows[0];
    assertLiveToken(invitation);
    if ((await client.query('SELECT 1 FROM users WHERE email=$1',[invitation.email])).rowCount) throw new HttpError(400,'El enlace no es válido o ya venció.');
    const user = (await client.query<User>(`INSERT INTO users(id,name,email,role,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING ${userColumns}`,[randomUUID(),name,invitation.email,invitation.role,passwordHash])).rows[0];
    await client.query('UPDATE invitations SET used_at=now() WHERE id=$1',[invitation.id]);
    const session = await addSession(client,user.id);
    await audit(client,user.id,'access.activate',user.id,'Cuenta activada');
    return {user,session};
  });
  setSession(res,result.session); res.json({user:result.user});
});
authRouter.post('/password', requireUser, async (req,res) => {
  const {currentPassword,newPassword:nextPassword} = z.object({currentPassword:z.string().min(1).max(128),newPassword:passwordSchema}).strict().parse(req.body);
  const actor = (res.locals.user as User).id;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  if (!await reserveAttempts([[`password:user:${actor}`,10],[`password:ip:${tokenDigest(ip)}`,30]])) throw new HttpError(429,'Demasiados intentos de contraseña. Inténtalo más tarde.');
  const passwordHash = await hashPassword(nextPassword);
  const result = await transaction(async client => {
    const user = (await client.query<User & {password_hash:string}>(`SELECT ${userColumns},password_hash FROM users WHERE id=$1 FOR UPDATE`,[(res.locals.user as User).id])).rows[0];
    if (!user?.active || !await verifyPassword(currentPassword,user.password_hash)) throw new HttpError(400,'La contraseña actual es incorrecta.');
    await client.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[passwordHash,user.id]);
    await client.query('DELETE FROM sessions WHERE user_id=$1',[user.id]);
    const session = await addSession(client,user.id);
    await audit(client,user.id,'access.password',user.id,'Contraseña cambiada; sesiones anteriores cerradas');
    const {password_hash:_hash,...publicUser} = user;
    return {user:publicUser,session};
  });
  setSession(res,result.session); res.json({user:result.user});
});
authRouter.get('/members', requireUser, requireManager, async (_req,res) => {
  const result = await pool.query<User>(`SELECT ${userColumns} FROM users ORDER BY name,email`); res.json({members:result.rows});
});
authRouter.post('/invitations', requireUser, requireManager, async (req,res) => {
  const {email,role} = z.object({email:emailSchema,role:roleSchema}).strict().parse(req.body);
  res.json(await createInvitation({email,role,createdBy:(res.locals.user as User).id}));
});
authRouter.patch('/members/:id', requireUser, requireManager, async (req,res) => {
  const id = z.string().uuid().parse(req.params.id);
  const patch = z.object({role:roleSchema.optional(),active:z.boolean().optional()}).strict().refine(value => value.role !== undefined || value.active !== undefined).parse(req.body);
  const actor = (res.locals.user as User).id;
  const user = await transaction(async client => {
    await lockManager(client,actor);
    const member = (await client.query<User>(`SELECT ${userColumns} FROM users WHERE id=$1 FOR UPDATE`,[id])).rows[0];
    if (!member) throw new HttpError(404,'La cuenta no existe.');
    const managers = Number((await client.query("SELECT count(*) FROM users WHERE active AND role='gerencia'")).rows[0].count);
    assertManagerChange(member,patch,actor,managers);
    const updated = (await client.query<User>(`UPDATE users SET role=COALESCE($1,role),active=COALESCE($2,active),updated_at=now() WHERE id=$3 RETURNING ${userColumns}`,[patch.role ?? null,patch.active ?? null,id])).rows[0];
    if (!updated.active) await client.query('DELETE FROM sessions WHERE user_id=$1',[id]);
    await audit(client,actor,'access.member',id,`Cuenta actualizada: ${updated.name}; rol ${updated.role}; ${updated.active ? 'activa' : 'inactiva'}`);
    return updated;
  });
  res.json({user});
});
