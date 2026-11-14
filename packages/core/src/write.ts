import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { hashText } from './hash.js';
import { loadProject, type Spec } from './project.js';
import { lockKey, withLock } from './lock.js';
import { withRetry } from './retry.js';
import { demoteH2 } from './sections.js';
import { slugify } from './slug.js';
import type { Urgency } from './types.js';

export type WriteResult =
  | { ok: true; hash: string; text: string }
  | { ok: false; conflict: true; currentText: string; currentHash: string };

/**
 * Apply `transform` and write the result, but only if the file still hashes to `baseHash`.
 * Calls for the same file are serialised in-process, so a later call with a stale hash gets a conflict.
 * Known limit: another process (e.g. Claude Code or an editor) can still write between the re-hash
 * below and the rename. The re-hash only narrows that cross-process window; it cannot close it.
 */
export async function writeIfUnchanged(file: string, baseHash: string, transform: (text: string) => string): Promise<WriteResult> {
  return withLock(lockKey(file), async (): Promise<WriteResult> => {
    const current = await withRetry(() => fs.readFile(file, 'utf8'));
    const currentHash = hashText(current);
    if (currentHash !== baseHash) return { ok: false, conflict: true, currentText: current, currentHash };
    const next = transform(current);
    const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, next, 'utf8');
    try {
      const again = await withRetry(() => fs.readFile(file, 'utf8'));
      const againHash = hashText(again);
      if (againHash !== baseHash) {
        await fs.rm(tmp, { force: true });
        return { ok: false, conflict: true, currentText: again, currentHash: againHash };
      }
      await withRetry(() => fs.rename(tmp, file));
    } catch (e) {
      await fs.rm(tmp, { force: true });
      throw e;
    }
    return { ok: true, hash: hashText(next), text: next };
  });
}

async function idsIn(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function nextId(root: string): Promise<string> {
  const sb = path.join(root, '.specboard');
  let max = 0;
  for (const kind of ['specs', 'archive']) {
    for (const name of await idsIn(path.join(sb, kind))) {
      const m = /^T-(\d+)/i.exec(name);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return `T-${String(max + 1).padStart(3, '0')}`;
}

function today(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export async function createSpec(
  root: string,
  input: { title: string; description: string; draft: boolean; urgency?: Urgency; categories?: string[] },
): Promise<Spec> {
  // One create at a time per project root (in-process), so concurrent calls get distinct IDs.
  return withLock(`create:${lockKey(root)}`, () => createSpecLocked(root, input));
}

async function createSpecLocked(
  root: string,
  input: { title: string; description: string; draft: boolean; urgency?: Urgency; categories?: string[] },
): Promise<Spec> {
  const specsDir = path.join(root, '.specboard', 'specs');
  await fs.mkdir(specsDir, { recursive: true });
  let prev = 0;
  for (let attempt = 1; attempt <= 5; attempt++) {
    // Never reuse an ID that already collided, even if nextId does not see the other writer yet.
    const n = Math.max(Number(/^T-(\d+)$/.exec(await nextId(root))![1]), prev + 1);
    prev = n;
    const id = `T-${String(n).padStart(3, '0')}`;
    const dir = path.join(specsDir, `${id}-${slugify(input.title)}`);
    try {
      await fs.mkdir(dir); // not recursive: fails with EEXIST if another writer took this folder
      await fs.writeFile(path.join(dir, 'spec.md'), specTemplate(id, input), { encoding: 'utf8', flag: 'wx' });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw e;
    }
    const spec = (await loadProject(root)).specs.find((s) => s.id === id);
    if (!spec) throw new Error(`Spec ${id} not found after create`);
    return spec;
  }
  throw new Error('Could not allocate a spec id after 5 attempts');
}

function specTemplate(id: string, input: { title: string; description: string; draft: boolean; urgency?: Urgency; categories?: string[] }): string {
  const date = today();
  const desc = demoteH2(input.description.replace(/\r\n/g, '\n').trim());
  return [
    '---',
    `id: ${id}`,
    `title: ${JSON.stringify(input.title)}`,
    'status: todo',
    `urgency: ${input.urgency ?? 'normal'}`,
    `categories: ${JSON.stringify(input.categories ?? [])}`,
    'depends_on: []',
    `draft: ${input.draft}`,
    'current_subtask: null',
    `created: ${date}`,
    `updated: ${date}`,
    '---',
    '',
    '## Spec',
    '',
    ...(desc === '' ? [] : [desc, '']),
    '## Features',
    '',
    '## Open questions',
    '',
    '## Subtasks',
    '',
  ].join('\n');
}

async function move(root: string, id: string, from: 'specs' | 'archive', to: 'specs' | 'archive'): Promise<void> {
  const p = await loadProject(root);
  const spec = (from === 'specs' ? p.specs : p.archived).find((s) => s.id === id);
  if (!spec) throw new Error(`Spec ${id} not found`);
  if (from === 'specs' && spec.status !== 'done') throw new Error('Only done specs can be archived');
  const dest = path.join(root, '.specboard', to, path.basename(spec.dir));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await withRetry(() => fs.rename(spec.dir, dest));
}

export async function archiveSpec(root: string, id: string): Promise<void> {
  await move(root, id, 'specs', 'archive');
}

export async function unarchiveSpec(root: string, id: string): Promise<void> {
  await move(root, id, 'archive', 'specs');
}

export async function initProject(root: string, name: string): Promise<void> {
  const sb = path.join(root, '.specboard');
  const config = path.join(sb, 'config.md');
  try {
    await fs.access(config);
    return;
  } catch {
    // not initialised yet
  }
  await fs.mkdir(path.join(sb, 'specs'), { recursive: true });
  await fs.mkdir(path.join(sb, 'archive'), { recursive: true });
  await fs.writeFile(config, `---\nname: ${JSON.stringify(name)}\ncreated: ${today()}\nreferences: []\n---\n`, 'utf8');
  const overview = path.join(sb, 'overview.md');
  try {
    await fs.access(overview);
  } catch {
    await fs.writeFile(overview, '---\nupdated: null\n---\n', 'utf8');
  }
}

/** Create `.specboard/settings.md` or update its `track_tokens` line, leaving other keys and the body untouched. */
export async function writeSettings(root: string, s: { trackTokens: boolean }): Promise<void> {
  const file = path.join(root, '.specboard', 'settings.md');
  await withLock(lockKey(file), async () => {
    let text: string | null = null;
    try {
      text = await withRetry(() => fs.readFile(file, 'utf8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    const line = `track_tokens: ${s.trackTokens}`;
    const open = text === null ? null : /^---[ \t]*\r?\n/.exec(text);
    const close = text !== null && open ? /^---[ \t]*(?:\r?\n|$)/m.exec(text.slice(open[0].length)) : null;
    let next: string;
    if (text === null || !open || !close) {
      // No front matter, or an opening `---` that never closes: put fresh front matter first and keep every word.
      next = `---\n${line}\n---\n${text ?? ''}`;
    } else {
      const start = open[0].length;
      const end = start + close.index;
      const fm = text.slice(start, end);
      const re = /^track_tokens:[^\r\n]*/m;
      const eol = open[0].endsWith('\r\n') ? '\r\n' : '\n';
      const nextFm = re.test(fm) ? fm.replace(re, line) : fm === '' || fm.endsWith('\n') ? fm + line + eol : fm + eol + line + eol;
      next = text.slice(0, start) + nextFm + text.slice(end);
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, next, 'utf8');
    try {
      await withRetry(() => fs.rename(tmp, file));
    } catch (e) {
      await fs.rm(tmp, { force: true });
      throw e;
    }
  });
}

/** Write `<dir>/<base>.draft.md` next to `file` (overwriting any earlier draft) and return its path. */
export async function writeSiblingDraft(file: string, text: string): Promise<string> {
  const { dir, name } = path.parse(file);
  const draft = path.join(dir, `${name}.draft.md`);
  await withRetry(() => fs.writeFile(draft, text, 'utf8'));
  return draft;
}
