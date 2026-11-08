import path from 'node:path';

const chains = new Map<string, Promise<void>>();

/** Lock key for a path: resolved, and lowercased on Windows where paths are case-insensitive. */
export function lockKey(p: string): string {
  const r = path.resolve(p);
  return process.platform === 'win32' ? r.toLowerCase() : r;
}

/**
 * Run `fn` after every earlier call with the same key has settled (in-process only).
 * Calls with different keys run concurrently.
 */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const run = prev.then(fn);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, tail);
  try {
    return await run;
  } finally {
    if (chains.get(key) === tail) chains.delete(key);
  }
}
