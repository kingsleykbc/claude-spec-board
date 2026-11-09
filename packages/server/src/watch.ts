import path from 'node:path';
import chokidar from 'chokidar';
import type { ProjectEntry } from './registry.js';

const DEBOUNCE_MS = 150;
/** A burst never delays the event longer than this after its first change. */
const MAX_WAIT_MS = 1000;

/** Editor scratch files and Spec Board drafts never count as changes. */
const ignored = (p: string): boolean => /\.tmp$/i.test(p) || /\.draft\.md$/i.test(p);

const sameFile = (a: string, b: string): boolean =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

/**
 * Watch `<root>/.specboard` plus each reference file. `refs` returns absolute, already-checked paths;
 * it is called again whenever config.md changes. Changes are debounced into one `onChange(entry.id)`.
 * Resolves once watching is ready, with an async function that stops everything.
 */
export async function watchProject(
  entry: ProjectEntry,
  refs: () => Promise<string[]>,
  onChange: (pid: string) => void,
): Promise<() => Promise<void>> {
  const specboard = path.join(entry.root, '.specboard');
  const configFile = path.join(specboard, 'config.md');
  let closed = false;
  let timer: NodeJS.Timeout | null = null;
  let burstStart = 0;
  let watched = new Set<string>();

  const watcher = chokidar.watch(specboard, {
    ignored,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
  });

  const fire = () => {
    if (closed) return;
    const now = Date.now();
    if (timer === null) burstStart = now;
    else clearTimeout(timer);
    const wait = Math.max(0, Math.min(DEBOUNCE_MS, burstStart + MAX_WAIT_MS - now));
    timer = setTimeout(() => {
      timer = null;
      if (!closed) onChange(entry.id);
    }, wait);
  };

  let syncing: Promise<void> = Promise.resolve();
  const syncRefs = (): Promise<void> => {
    syncing = syncing.then(async () => {
      if (closed) return;
      let next: string[];
      try {
        next = await refs();
      } catch {
        return; // keep what we watch now
      }
      if (closed) return;
      const want = new Set(next);
      for (const f of watched) if (!want.has(f)) await watcher.unwatch(f);
      const add = [...want].filter((f) => !watched.has(f));
      if (add.length > 0) watcher.add(add);
      watched = want;
    });
    return syncing;
  };

  const onEvent = (_event: string, file: string) => {
    if (sameFile(path.resolve(file), configFile)) void syncRefs();
    fire();
  };
  watcher.on('all', onEvent);
  watcher.on('error', (e) => console.error(`Watching ${entry.root} failed: ${e instanceof Error ? e.message : String(e)}`));

  const ready = new Promise<void>((resolve) => {
    watcher.once('ready', () => resolve());
  });
  await syncRefs();
  await ready;

  return async () => {
    closed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    await syncing.catch(() => undefined);
    await watcher.close();
  };
}
