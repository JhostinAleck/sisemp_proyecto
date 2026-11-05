import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

export function loadLocalEnv(directory = process.cwd()): void {
  const path = resolve(directory, '.env.local');
  if (existsSync(path)) process.loadEnvFile(path);
}

function port(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535)
    throw new Error('El puerto debe ser un entero entre 1 y 65535.');
  return parsed;
}

export function localConfig(env: NodeJS.ProcessEnv, args: string[]) {
  let webPort = port(env.DEV_PORT, 5173);
  for (let i=0; i<args.length; i++) {
    if (args[i] === '--port' && args[i+1]) webPort = port(args[++i], 5173);
    else if (args[i].startsWith('--port=')) webPort = port(args[i].slice(7), 5173);
    else throw new Error('Uso: npm run dev -- --port 5174');
  }
  const apiPort = port(env.DEV_API_PORT, 3000);
  if (apiPort === webPort) throw new Error('Frontend y API necesitan puertos diferentes.');
  const databaseUrl = env.DATABASE_URL || 'postgresql://localhost/burning_bull';
  let database: URL;
  try { database = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL debe ser una URL PostgreSQL local.'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !['localhost','127.0.0.1','[::1]'].includes(database.hostname) || !database.pathname.slice(1) || ['host','hostaddr'].some(key => database.searchParams.has(key)))
    throw new Error('Desarrollo requiere DATABASE_URL local (localhost, 127.0.0.1 o ::1) y una base dedicada.');
  const databaseName = decodeURIComponent(database.pathname.slice(1));
  if (['postgres','template0','template1'].includes(databaseName))
    throw new Error('Usa una base local dedicada; no postgres ni template0/template1.');
  return { webPort, apiPort, origin:`http://localhost:${webPort}`, databaseUrl, databaseName,
    adminEmail: env.LOCAL_ADMIN_EMAIL || 'gerencia@burningbull.local' };
}
export type LocalConfig = ReturnType<typeof localConfig>;

export function applyLocalConfig(config: LocalConfig): void {
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = config.databaseUrl;
  process.env.APP_ORIGIN = config.origin;
  process.env.PORT = String(config.apiPort);
  process.env.DEV_API_PORT = String(config.apiPort);
  process.env.DEV_PORT = String(config.webPort);
  // Deployment bootstrap settings must never provision a local account.
  delete process.env.BOOTSTRAP_INVITE_TOKEN;
  delete process.env.BOOTSTRAP_MANAGER_EMAIL;
  delete process.env.BOOTSTRAP_MANAGER_NAME;
}

export async function assertPortAvailable(portNumber: number): Promise<void> {
  for (const host of ['127.0.0.1', '::1']) {
    await new Promise<void>((resolve, reject) => {
      const server = createServer();
      server.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EAFNOSUPPORT' || error.code === 'EADDRNOTAVAIL') resolve();
        else reject(new Error(`El puerto ${portNumber} está ocupado. Cierra ese servicio o configura DEV_PORT y DEV_API_PORT libres.`));
      });
      server.listen({port:portNumber, host, exclusive:true}, () => server.close(error => error ? reject(error) : resolve()));
    });
  }
}
