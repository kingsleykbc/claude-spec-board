import path from 'node:path';
import chokidar from 'chokidar';
import type { ProjectEntry } from './registry.js';

const DEBOUNCE_MS = 150;

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
  let watched = new Set<string>();

  const watcher = chokidar.watch(specboard, {
    ignored,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
  });

  const fire = () => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!closed) onChange(entry.id);
    }, DEBOUNCE_MS);
  };

  let syncing: Promise<void> = Promise.resolve();
  const syncRefs = (): Promise<void> => {
    syncing = syncing.then(async () => {
      if (closed) return;
      let next: string[];
      try {
        next = await refs();
      } catch {
        next = [];
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
  watcher.on('error', () => undefined);

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
