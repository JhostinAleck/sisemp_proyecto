import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, tokenDigest, newToken } from '../server/access/crypto';
import { assertPassword, assertLiveToken, assertManagerChange, assertManager, sessionCookie, readSessionCookie } from '../server/access/security';

// A missing salt or plaintext storage would break this test.
test('password hashes are independently salted and verify only the correct secret', async () => {
  const first = await hashPassword('correct-horse-battery');
  const second = await hashPassword('correct-horse-battery');
  assert.notEqual(first, second);
  assert.equal(first.includes('correct-horse-battery'), false);
  assert.equal(await verifyPassword('correct-horse-battery', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword('correct-horse-battery', 'invalid'), false);
});

test('password bounds reject short and oversized passwords without truncation', () => {
  assert.throws(() => assertPassword('x'.repeat(11)));
  assert.doesNotThrow(() => assertPassword('x'.repeat(12)));
  assert.doesNotThrow(() => assertPassword('x'.repeat(128)));
  assert.throws(() => assertPassword('x'.repeat(129)));
});

test('opaque tokens contain at least 256 bits and persistence uses a one-way digest', () => {
  const token = newToken();
  assert.equal(Buffer.from(token, 'base64url').length >= 32, true);
  assert.notEqual(token, newToken());
  assert.equal(tokenDigest(token).length, 64);
  assert.notEqual(tokenDigest(token), token);
});

test('expired and already-used invitations and sessions fail closed at the boundary', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  assert.doesNotThrow(() => assertLiveToken({expires_at: new Date('2026-11-05T12:00:01Z')}, now));
  assert.throws(() => assertLiveToken({expires_at: now}, now));
  assert.throws(() => assertLiveToken({expires_at: new Date('2026-11-05T12:00:01Z'), used_at: now}, now));
  assert.throws(() => assertLiveToken(null, now));
});

test('member changes cannot disable self or remove the last active manager', () => {
  const manager = {id:'manager',role:'gerencia',active:true};
  assert.throws(() => assertManagerChange(manager, {active:false}, 'manager', 2));
  assert.throws(() => assertManagerChange(manager, {role:'bodega'}, 'other', 1));
  assert.throws(() => assertManagerChange(manager, {active:false}, 'other', 1));
  assert.doesNotThrow(() => assertManagerChange(manager, {role:'bodega'}, 'other', 2));
});

test('only active managers can administer membership', () => {
  assert.throws(() => assertManager({role:'bodega',active:true}));
  assert.throws(() => assertManager({role:'gerencia',active:false}));
  assert.doesNotThrow(() => assertManager({role:'gerencia',active:true}));
});

test('session cookies protect production credentials and can be expired', () => {
  const value = sessionCookie('opaque', true);
  assert.match(value, /HttpOnly/);
  assert.match(value, /Secure/);
  assert.match(value, /SameSite=Lax/);
  assert.match(value, /Path=\//);
  assert.match(sessionCookie('', true), /Max-Age=0/);
  assert.equal(readSessionCookie('other=x; bb_session=opaque'), 'opaque');
  assert.equal(readSessionCookie('bb_session=bad%XX'), undefined);
  assert.equal(readSessionCookie('bb_session=one; bb_session=two'), undefined);
});

// These requests use the real Express router and PostgreSQL, including concurrent requests.
test('PostgreSQL auth enforces invitation, revocation, authorization and login limits', {skip: !process.env.TEST_DATABASE_URL}, async (t) => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.APP_ORIGIN = 'http://localhost:5173';
  const [{default:express}, {pool}, {migrate}, {authRouter,createInvitation,ensureBootstrapInvitation}] = await Promise.all([
    import('express'), import('../server/db'), import('../server/migrate'), import('../server/access/router'),
  ]);
  t.after(() => pool.end());
  await migrate();
  await pool.query('TRUNCATE audit_events,sessions,invitations,auth_limits,users CASCADE');
  const bootstrapToken = newToken();
  await assert.rejects(() => ensureBootstrapInvitation('first@example.com','First','weak'));
  assert.equal((await ensureBootstrapInvitation('first@example.com','First',bootstrapToken)).created, true);
  assert.equal((await ensureBootstrapInvitation('first@example.com','First',bootstrapToken)).created, false);
  assert.equal((await ensureBootstrapInvitation('other@example.com','Other',newToken())).created, false);
  const bootRows = await pool.query('SELECT token_hash FROM invitations');
  assert.equal(bootRows.rows.length,1);
  assert.equal(bootRows.rows[0].token_hash,tokenDigest(bootstrapToken));
  await pool.query('TRUNCATE audit_events,invitations');
  const app = express(); app.use(express.json()); app.use('/api/auth', authRouter);
  app.use((error: Error & {status?:number}, _req: unknown, res: any, _next: unknown) => res.status(error.status ?? 400).json({error:error.message}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as {port:number};
  async function request(path: string, data?: unknown, cookie?:string, method = data ? 'POST' : 'GET') {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth${path}`, {method, headers:{'Content-Type':'application/json', ...(cookie ? {Cookie:cookie} : {})}, ...(data ? {body:JSON.stringify(data)} : {})});
    return {status:response.status, body: response.headers.get('content-type')?.includes('application/json') ? await response.json() : {}, cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  try {
    assert.equal((await request('/session')).body.user, null);
    assert.equal((await request('/members')).status, 401);
    const invitation = await createInvitation({email:'manager@example.com', role:'gerencia', bootstrap:true});
    const token = new URLSearchParams(new URL(invitation.url).hash.slice(1)).get('token')!;
    assert.equal((await request(`/invitation?token=${token}`)).body.email, 'manager@example.com');
    const activated = await request('/activate', {token,name:'Manager',password:'manager-password-123'});
    assert.equal(activated.status, 200);
    const manager = activated.body.user;
    let cookie = activated.cookie!;
    assert.equal((await request('/activate',{token,name:'Again',password:'manager-password-123'})).status, 400);
    assert.equal((await request('/members',undefined,cookie)).body.members.length, 1);
    assert.equal((await request(`/members/${manager.id}`,{active:false},cookie,'PATCH')).status, 400);
    assert.equal((await request(`/members/${manager.id}`,{role:'bodega'},cookie,'PATCH')).status, 400);
    const invite = await request('/invitations',{email:'warehouse@example.com',role:'bodega'},cookie);
    const workerToken = new URLSearchParams(new URL(invite.body.url).hash.slice(1)).get('token')!;
    const activations = await Promise.all([1,2].map(() => request('/activate',{token:workerToken,name:'Warehouse',password:'warehouse-password-123'})));
    assert.deepEqual(activations.map(r=>r.status).sort(), [200,400]);
    const worker = activations.find(r=>r.status === 200)!;
    assert.equal((await request('/members',undefined,worker.cookie)).status, 403);
    assert.equal((await request('/invitations',{email:'bad@example.com',role:'gerencia'},worker.cookie)).status, 403);
    await request(`/members/${worker.body.user.id}`,{role:'compras'},cookie,'PATCH');
    assert.equal((await request('/session',undefined,worker.cookie)).body.user.role, 'compras');
    await request(`/members/${worker.body.user.id}`,{active:false},cookie,'PATCH');
    assert.equal((await request('/session',undefined,worker.cookie)).body.user, null);
    assert.equal((await request('/login',{email:'warehouse@example.com',password:'warehouse-password-123'})).status, 401);
    const passwordChange = await request('/password',{currentPassword:'manager-password-123',newPassword:'manager-password-456'},cookie);
    assert.equal(passwordChange.status, 200);
    assert.equal((await request('/session',undefined,cookie)).body.user, null);
    cookie = passwordChange.cookie!;
    assert.equal((await request('/session',undefined,cookie)).body.user.id, manager.id);
    assert.equal((await request('/login',{email:'manager@example.com',password:'manager-password-123'})).status, 401);
    assert.equal((await request('/login',{email:'manager@example.com',password:'manager-password-456'})).status, 200);
    await pool.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
    assert.equal((await request('/session',undefined,cookie)).body.user, null);
    const expired = await createInvitation({email:'expired@example.com',role:'bodega',createdBy:manager.id});
    const expiredToken = new URLSearchParams(new URL(expired.url).hash.slice(1)).get('token')!;
    await pool.query("UPDATE invitations SET expires_at=now()-interval '1 second' WHERE email='expired@example.com'");
    assert.equal((await request('/activate',{token:expiredToken,name:'Expired',password:'expired-password-123'})).status, 400);
    const attempts = await Promise.all(Array.from({length:12}, () => request('/login',{email:'nobody@example.com',password:'incorrect-password'})));
    assert.equal(attempts.filter(r=>r.status===401).length, 10);
    assert.equal(attempts.filter(r=>r.status===429).length, 2);
    const raw = await pool.query('SELECT token_hash FROM sessions UNION ALL SELECT token_hash FROM invitations');
    assert.equal(raw.rows.every(row => /^[a-f0-9]{64}$/.test(row.token_hash)), true);
    t.diagnostic('Real PostgreSQL and HTTP: single-use invite race, latest role/active, expiry, password revocation and parallel SQL rate limits verified.');
  } finally {
    await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
