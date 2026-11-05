import { spawn } from 'node:child_process';
import { loadLocalEnv } from './dev-config';
import { superviseChildren } from './dev-processes';
loadLocalEnv();
const [script,...args] = process.argv.slice(2);
if (!script) throw new Error('Falta el script de servidor.');
const child = spawn(process.execPath, ['--import','tsx',script,...args], {env:process.env, stdio:'inherit'});
process.exitCode = await superviseChildren([child]);
