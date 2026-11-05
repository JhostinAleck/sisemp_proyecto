import { mkdir, open, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db';
import { migrate } from '../migrate';
import { createInvitation } from './router';

/** Writes the initial manager link to a private file; never prints its bearer token. */
export async function bootstrap(input: {email:string; name?:string; output?:string}): Promise<string> {
  const path = resolve(input.output ?? '.secrets/bootstrap.json');
  await mkdir(dirname(path), {recursive:true,mode:0o700});
  const file = await open(path,'wx',0o600);
  try {
    const invitation = await createInvitation({email:input.email,role:'gerencia',bootstrap:true});
    await file.writeFile(JSON.stringify({email:input.email,name:input.name ?? '',...invitation},null,2)+'\n');
  } catch (error) { await unlink(path); throw error; }
  finally { await file.close(); }
  return path;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name:string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i+1]; };
  const email = flag('--email');
  if (!email) { console.error('Usage: tsx server/access/bootstrap.ts --email manager@example.com [--name Name] [--output .secrets/bootstrap.json]'); process.exitCode=1; }
  else {
    try {
      await migrate();
      const path = await bootstrap({email,name:flag('--name'),output:flag('--output')});
      console.log(`Private activation invitation written to ${path}`);
    } catch { console.error('Bootstrap failed. Check database configuration and whether an initial account or output file already exists.'); process.exitCode=1; }
    finally { await pool.end(); }
  }
}
