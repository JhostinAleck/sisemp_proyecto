import type { ChildProcess } from 'node:child_process';

/** Owns only children it starts; waits for all of them before returning. */
export async function superviseChildren(children: ChildProcess[]): Promise<number> {
  let closing = false;
  let exitCode = 0;
  let forceTimer: NodeJS.Timeout | undefined;
  const stop = (code: number) => {
    if (closing) return;
    closing = true;
    exitCode = code;
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    forceTimer = setTimeout(() => {
      for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 5000);
    forceTimer.unref();
  };
  const onInterrupt = () => stop(130);
  const onTerminate = () => stop(143);
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onTerminate);
  try {
    await Promise.all(children.map(child => new Promise<void>(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) { stop(child.exitCode ?? 1); resolve(); return; }
      child.once('error', () => stop(1));
      child.once('close', code => { stop(code ?? 1); resolve(); });
    })));
    return exitCode;
  } finally {
    if (forceTimer) clearTimeout(forceTimer);
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
  }
}
