import { applyLocalConfig, loadLocalEnv, localConfig } from './dev-config';
import { closeLocalDatabase, databaseHelp, prepareLocalDatabase } from './local-database';

try {
  loadLocalEnv();
  const config = localConfig(process.env, []);
  applyLocalConfig(config);
  const access = await prepareLocalDatabase(config);
  console.log('PostgreSQL local preparado; los datos existentes se conservan.');
  if (access) {
    console.log(`Cuenta inicial: ${access.email}`);
    console.log(`Enlace privado de activación: ${access.url}`);
    console.log('Elige tu contraseña al activar. El enlace también está en .secrets/local-access.json.');
  } else console.log('La cuenta inicial ya existe. Inicia sesión con tu contraseña.');
} catch (error) {
  console.error(databaseHelp);
  // Configuration errors are authored locally and never contain a connection string.
  if (error instanceof Error && /^(Desarrollo requiere|DATABASE_URL debe|Usa una base|El nombre|Ya existe otra|No se pudo leer|La invitación)/.test(error.message)) console.error(error.message);
  process.exitCode=1;
} finally { await closeLocalDatabase(); }
