import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { hashText, loadProject, parseConfig, setConfigReferences, writeIfUnchanged, writeSiblingDraft } from '@specboard/core';
import type { Registry, ProjectEntry } from '../registry.js';
import { HttpError, onError, readJson, requireString } from '../http.js';
import { PathError, safeProjectPath } from '../safePath.js';

const SKIP_DIRS = new Set(['node_modules', '.git', '.specboard']);
const MAX_DEPTH = 6;
const MAX_RESULTS = 20;

const toRel = (root: string, file: string) => path.relative(root, file).split(path.sep).join('/');

async function walk(root: string, dir: string, depth: number, out: string[]): Promise<void> {
  if (depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) await walk(root, path.join(dir, e.name), depth + 1, out);
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      out.push(toRel(root, path.join(dir, e.name)));
    }
  }
}

export function referenceRoutes(registry: Registry): Hono {
  const app = new Hono();

  const project = async (c: Context): Promise<ProjectEntry> => {
    const entry = await registry.get(c.req.param('pid') ?? '');
    if (!entry) throw new HttpError(404, 'Unknown project');
    return entry;
  };

  /** Resolve a request path; unsafe input is a 400. */
  const safe = (root: string, rel: string): string => {
    try {
      return safeProjectPath(root, rel);
    } catch (e) {
      if (e instanceof PathError) throw new HttpError(400, e.message);
      throw e;
    }
  };

  /** Rewrite config.md's references list under a hash check; `change` returns null for "no change". */
  const updateRefs = async (root: string, change: (refs: string[]) => string[] | null): Promise<void> => {
    const config = path.join(root, '.specboard', 'config.md');
    const text = await fs.readFile(config, 'utf8');
    const res = await writeIfUnchanged(config, hashText(text), (t) => {
      const next = change(parseConfig(t).references);
      return next === null ? t : setConfigReferences(t, next);
    });
    if (!res.ok) throw new Error('config.md changed during update');
  };

  app.get('/api/projects/:pid/references', async (c) => {
    const entry = await project(c);
    const { config } = await loadProject(entry.root);
    const out = await Promise.all(
      (config?.references ?? []).map(async (ref) => {
        const name = ref.split(/[\\/]/).pop() ?? ref;
        try {
          const md = await fs.readFile(safeProjectPath(entry.root, ref), 'utf8');
          return { name, path: ref, md, hash: hashText(md), missing: false };
        } catch {
          return { name, path: ref, md: '', hash: '', missing: true };
        }
      }),
    );
    return c.json(out);
  });

  app.put('/api/projects/:pid/references/content', async (c) => {
    const b = await readJson(c);
    const rel = requireString(b, 'path', false);
    const hash = requireString(b, 'hash', false);
    const md = requireString(b, 'md');
    const entry = await project(c);
    const file = safe(entry.root, rel);
    const res = await writeIfUnchanged(file, hash, () => md).catch((e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') throw new HttpError(404, 'File not found');
      throw e;
    });
    if (!res.ok) return c.json({ conflict: true, currentHash: res.currentHash, currentText: res.currentText }, 409);
    return c.json({ hash: hashText(md) });
  });

  app.post('/api/projects/:pid/references/link', async (c) => {
    const b = await readJson(c);
    const rel = requireString(b, 'path', false);
    const entry = await project(c);
    const file = safe(entry.root, rel);
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) throw new HttpError(404, 'File not found');
    const norm = toRel(entry.root, file);
    await updateRefs(entry.root, (refs) => (refs.includes(norm) ? null : [...refs, norm]));
    return c.json({ path: norm });
  });

  app.post('/api/projects/:pid/references/create', async (c) => {
    const b = await readJson(c);
    const raw = requireString(b, 'name', false);
    const name = raw.trim().replace(/\.md$/i, '').toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(name)) throw new HttpError(400, 'Invalid name');
    const entry = await project(c);
    const rel = `docs/${name}.md`;
    const file = safe(entry.root, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    try {
      await fs.writeFile(file, `# ${name}\n\n`, { encoding: 'utf8', flag: 'wx' });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') return c.json({ error: 'Already exists' }, 409);
      throw e;
    }
    await updateRefs(entry.root, (refs) => (refs.includes(rel) ? null : [...refs, rel]));
    return c.json({ path: rel }, 201);
  });

  app.delete('/api/projects/:pid/references', async (c) => {
    const rel = c.req.query('path') ?? '';
    if (rel === '') throw new HttpError(400, 'Missing "path"');
    const entry = await project(c);
    const norm = toRel(entry.root, safe(entry.root, rel));
    let found = false;
    await updateRefs(entry.root, (refs) => {
      const next = refs.filter((r) => r.replace(/\\/g, '/') !== norm);
      found = next.length !== refs.length;
      return found ? next : null;
    });
    if (!found) throw new HttpError(404, 'Reference not found');
    return c.body(null, 204);
  });

  app.post('/api/projects/:pid/references/draft-copy', async (c) => {
    const b = await readJson(c);
    const rel = requireString(b, 'path', false);
    const md = requireString(b, 'md');
    const entry = await project(c);
    const file = safe(entry.root, rel);
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) throw new HttpError(404, 'File not found');
    const draft = await writeSiblingDraft(file, md);
    return c.json({ path: toRel(entry.root, draft) });
  });

  app.get('/api/projects/:pid/files', async (c) => {
    const entry = await project(c);
    const q = (c.req.query('q') ?? '').toLowerCase();
    const all: string[] = [];
    await walk(entry.root, entry.root, 0, all);
    return c.json(all.filter((p) => p.toLowerCase().includes(q)).sort().slice(0, MAX_RESULTS));
  });

  app.onError(onError);
  return app;
}
