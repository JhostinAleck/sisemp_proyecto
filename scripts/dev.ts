import { spawn } from 'node:child_process';
import { applyLocalConfig, assertPortAvailable, loadLocalEnv, localConfig } from './dev-config';
import { closeLocalDatabase, databaseHelp, prepareLocalDatabase } from './local-database';
import { superviseChildren } from './dev-processes';

try {
  loadLocalEnv();
  const config = localConfig(process.env, process.argv.slice(2));
  applyLocalConfig(config);
  await assertPortAvailable(config.webPort);
  await assertPortAvailable(config.apiPort);
  let access;
  try { access = await prepareLocalDatabase(config); }
  catch (error) {
    if (error instanceof Error && /^(Ya existe otra|No se pudo leer|La invitación|El nombre)/.test(error.message)) throw error;
    throw new Error(databaseHelp);
  }
  finally { await closeLocalDatabase(); }
  console.log(`Burning Bull local: ${config.origin}`);
  if (access) {
    console.log(`Primera cuenta: ${access.email}. Abre este enlace privado y elige tu contraseña:`);
    console.log(access.url);
    console.log('Copia privada: .secrets/local-access.json');
  } else console.log('Inicia sesión con tu cuenta local existente.');
  const options = {env:process.env, stdio:'inherit' as const};
  const api = spawn(process.execPath, ['--import','tsx','server/index.ts'], options);
  const web = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(config.webPort),'--strictPort'], options);
  process.exitCode = await superviseChildren([api,web]);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo iniciar el desarrollo local.');
  process.exitCode = 1;
}
