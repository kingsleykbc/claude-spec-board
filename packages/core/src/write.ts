import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { hashText } from './hash.js';
import { loadProject, type Spec } from './project.js';
import { slugify } from './slug.js';
import type { Urgency } from './types.js';

export type WriteResult =
  | { ok: true; hash: string; text: string }
  | { ok: false; conflict: true; currentText: string; currentHash: string };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Retry an fs operation on Windows EPERM/EBUSY (up to 5 attempts, 50 ms backoff). */
async function withRetry(op: () => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await op();
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if ((code !== 'EPERM' && code !== 'EBUSY') || attempt >= 5) throw e;
      await sleep(50);
    }
  }
}

export async function writeIfUnchanged(file: string, baseHash: string, transform: (text: string) => string): Promise<WriteResult> {
  const current = await fs.readFile(file, 'utf8');
  const currentHash = hashText(current);
  if (currentHash !== baseHash) return { ok: false, conflict: true, currentText: current, currentHash };
  const next = transform(current);
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await fs.writeFile(tmp, next, 'utf8');
  try {
    await withRetry(() => fs.rename(tmp, file));
  } catch (e) {
    await fs.rm(tmp, { force: true });
    throw e;
  }
  return { ok: true, hash: hashText(next), text: next };
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
  const id = await nextId(root);
  const dir = path.join(root, '.specboard', 'specs', `${id}-${slugify(input.title)}`);
  const date = today();
  const desc = input.description.replace(/\r\n/g, '\n').trim();
  const text = [
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
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'spec.md'), text, 'utf8');
  const spec = (await loadProject(root)).specs.find((s) => s.id === id);
  if (!spec) throw new Error(`Spec ${id} not found after create`);
  return spec;
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
  await fs.writeFile(config, `---\nname: ${JSON.stringify(name)}\nreferences: []\n---\n`, 'utf8');
  const overview = path.join(sb, 'overview.md');
  try {
    await fs.access(overview);
  } catch {
    await fs.writeFile(overview, '---\nupdated: null\n---\n', 'utf8');
  }
}
