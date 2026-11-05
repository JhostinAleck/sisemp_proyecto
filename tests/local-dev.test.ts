import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

test('local launcher exists and keeps configuration local', async () => {
  const module = await import('../scripts/dev-config.ts').catch(() => null);
  assert.ok(module, 'local configuration module must exist');
  const defaults = module.localConfig({}, []);
  assert.equal(defaults.origin, 'http://localhost:5173');
  assert.equal(defaults.databaseUrl, 'postgresql://localhost/burning_bull');
  assert.equal(defaults.apiPort, 3000);
  assert.equal(module.localConfig({ DEV_PORT: '5174', DEV_API_PORT: '3001', NODE_ENV: 'production' }, []).origin, 'http://localhost:5174');
  assert.equal(module.localConfig({}, ['--port', '5175']).webPort, 5175);
  assert.throws(() => module.localConfig({ DATABASE_URL: 'postgresql://prod.example/db' }, []), /local|loopback/i);
  assert.throws(() => module.localConfig({ DEV_PORT: '0' }, []), /puerto/i);
  assert.throws(() => module.localConfig({ DEV_PORT: '3000' }, []), /diferentes/i);
});

test('port check rejects occupied ports without stopping their owner', async () => {
  const module = await import('../scripts/dev-config.ts').catch(() => null);
  assert.ok(module, 'port validation must exist');
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as {port:number}).port;
    await assert.rejects(module.assertPortAvailable(port), /ocupado/);
    assert.equal(server.listening, true);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('local env loads before setup imports and preserves explicit shell settings', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bb-env-'));
  try {
    await writeFile(join(directory, '.env.local'), 'DEV_PORT=5191\nLOCAL_TEST_MARKER=loaded\n');
    const importUrl = pathToFileURL(join(process.cwd(), 'scripts/dev-config.ts')).href;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `const m=await import(${JSON.stringify(importUrl)});m.loadLocalEnv(${JSON.stringify(directory)});console.log(process.env.DEV_PORT, process.env.LOCAL_TEST_MARKER)`], { env: {...process.env, DEV_PORT:'5192'}, stdio:['ignore','pipe','pipe'] });
    let output=''; child.stdout.on('data', data => output+=data);
    const code = await new Promise(resolve => child.on('exit', resolve));
    assert.equal(code, 0); assert.equal(output.trim(), '5192 loaded');
  } finally { await rm(directory, {recursive:true, force:true}); }
});

test('supervisor stops the other process when one child fails', async () => {
  const module = await import('../scripts/dev-processes.ts').catch(() => null);
  assert.ok(module, 'local process supervisor must exist');
  const directory = await mkdtemp(join(tmpdir(), 'bb-process-'));
  try {
    const heartbeat = join(directory, 'heartbeat');
    const worker = spawn(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(heartbeat)},'running');setInterval(()=>{},1000)`], {stdio:'ignore'});
    await new Promise(resolve => worker.once('spawn', resolve));
    const failure = spawn(process.execPath, ['-e', 'setTimeout(()=>process.exit(7),200)'], {stdio:'ignore'});
    assert.equal(await module.superviseChildren([worker, failure]), 7);
    assert.notEqual(worker.exitCode, undefined);
    assert.equal(await readFile(heartbeat, 'utf8'), 'running');
  } finally { await rm(directory, {recursive:true, force:true}); }
});

test('database errors give a local PostgreSQL remedy without exposing credentials', async () => {
  const child = spawn(process.execPath, ['--import','tsx','scripts/local-setup.ts'], {
    env: {...process.env, DATABASE_URL:'postgresql://local:never-print-this@127.0.0.1:1/bb_missing'},
    stdio:['ignore','pipe','pipe']
  });
  let output=''; child.stdout.on('data', data => output+=data); child.stderr.on('data', data => output+=data);
  const code = await new Promise(resolve => child.on('exit', resolve));
  assert.equal(code, 1);
  assert.match(output, /PostgreSQL local/);
  assert.match(output, /docker compose up -d db/);
  assert.doesNotMatch(output, /never-print-this/);
});

test('fresh local database is initialized once and activation survives restart', {skip: !process.env.TEST_LOCAL_DATABASE_URL}, async () => {
  const module = await import('../scripts/dev-config.ts');
  const setupModule = await import('../scripts/local-database.ts');
  const config = module.localConfig({...process.env, DATABASE_URL:process.env.TEST_LOCAL_DATABASE_URL}, []);
  module.applyLocalConfig(config);
  const first = await setupModule.prepareLocalDatabase(config);
  const second = await setupModule.prepareLocalDatabase(config);
  assert.ok(first?.url.includes('/activar#token='));
  assert.equal(first?.url, second?.url);
  const {pool} = await import('../server/db.ts');
  try {
    assert.equal(Number((await pool.query('SELECT count(*) FROM invitations')).rows[0].count), 1);
    assert.equal(Number((await pool.query('SELECT count(*) FROM app_state')).rows[0].count), 1);
  } finally { await pool.end(); }
});

test('supervisor preserves successful setup commands and parent shutdown', async () => {
  const { superviseChildren } = await import('../scripts/dev-processes.ts');
  const completed = spawn(process.execPath, ['-e','process.exit(0)'], {stdio:'ignore'});
  assert.equal(await superviseChildren([completed]),0);
  const worker = spawn(process.execPath, ['-e','setInterval(()=>{},1000)'], {stdio:'ignore'});
  await new Promise(resolve => worker.once('spawn',resolve));
  const stopped = superviseChildren([worker]);
  process.emit('SIGTERM');
  assert.equal(await stopped,143);
  assert.ok(worker.exitCode !== null || worker.signalCode !== null);
});
