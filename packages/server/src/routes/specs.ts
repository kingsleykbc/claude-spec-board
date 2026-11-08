import path from 'node:path';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  archiveSpec,
  createSpec,
  loadProject,
  replaceSpecBody,
  setAnswers,
  setMetaField,
  setSubtaskDone,
  unarchiveSpec,
  writeIfUnchanged,
  writeSiblingDraft,
} from '@specboard/core';
import type { Spec } from '@specboard/core';
import type { Registry, ProjectEntry } from '../registry.js';
import { HttpError, onError, readJson, requireString } from '../http.js';

const META_KEYS = ['status', 'urgency', 'categories', 'title', 'draft'] as const;
type MetaKey = (typeof META_KEYS)[number];

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function findSpec(p: { specs: Spec[]; archived: Spec[] }, id: string): Spec | undefined {
  return p.specs.find((s) => s.id === id) ?? p.archived.find((s) => s.id === id);
}

export function specRoutes(registry: Registry): Hono {
  const app = new Hono();

  const project = async (c: Context): Promise<ProjectEntry> => {
    const entry = await registry.get(c.req.param('pid') ?? '');
    if (!entry) throw new HttpError(404, 'Unknown project');
    return entry;
  };

  /** Look up the spec (active or archived) or throw a 404. */
  const locate = async (c: Context): Promise<{ entry: ProjectEntry; spec: Spec }> => {
    const entry = await project(c);
    const id = c.req.param('id') ?? '';
    const spec = findSpec(await loadProject(entry.root), id);
    if (!spec) throw new HttpError(404, `Spec ${id} not found`);
    return { entry, spec };
  };

  /** Run a hash-checked transform, then reload and answer with the new spec. */
  const mutate = async (c: Context, transform: (text: string) => string, hash: string): Promise<Response> => {
    const { entry, spec } = await locate(c);
    const res = await writeIfUnchanged(spec.path, hash, transform);
    if (!res.ok) return c.json({ conflict: true, currentHash: res.currentHash, currentText: res.currentText }, 409);
    const fresh = findSpec(await loadProject(entry.root), spec.id);
    if (!fresh) throw new Error(`Spec ${spec.id} missing after write`);
    return c.json({ hash: fresh.hash, spec: fresh });
  };

  app.patch('/api/projects/:pid/specs/:id/meta', async (c) => {
    const b = await readJson(c);
    const hash = requireString(b, 'hash', false);
    const key = b.key;
    if (typeof key !== 'string' || !(META_KEYS as readonly string[]).includes(key)) throw new HttpError(400, `Invalid key`);
    if (!('value' in b)) throw new HttpError(400, 'Missing "value"');
    return mutate(
      c,
      (text) => {
        // Validate the field first, then bump `updated`, all inside one write.
        const withKey = setMetaField(text, key as MetaKey, b.value as never);
        return setMetaField(withKey, 'updated', today());
      },
      hash,
    );
  });

  app.patch('/api/projects/:pid/specs/:id/subtasks/:n', async (c) => {
    const b = await readJson(c);
    const hash = requireString(b, 'hash', false);
    if (typeof b.done !== 'boolean') throw new HttpError(400, 'Missing or invalid "done"');
    const n = Number(c.req.param('n'));
    if (!Number.isInteger(n)) throw new HttpError(400, 'Invalid subtask number');
    return mutate(c, (text) => setSubtaskDone(text, n, b.done as boolean), hash);
  });

  app.patch('/api/projects/:pid/specs/:id/answers', async (c) => {
    const b = await readJson(c);
    const hash = requireString(b, 'hash', false);
    const a = b.answers;
    if (typeof a !== 'object' || a === null || Array.isArray(a) || !Object.values(a).every((v) => typeof v === 'string'))
      throw new HttpError(400, 'Missing or invalid "answers"');
    return mutate(c, (text) => setAnswers(text, a as Record<string, string>), hash);
  });

  app.patch('/api/projects/:pid/specs/:id/body', async (c) => {
    const b = await readJson(c);
    const hash = requireString(b, 'hash', false);
    const md = requireString(b, 'md');
    return mutate(c, (text) => replaceSpecBody(text, md), hash);
  });

  app.post('/api/projects/:pid/specs/:id/draft-copy', async (c) => {
    const b = await readJson(c);
    const md = requireString(b, 'md');
    const { entry, spec } = await locate(c);
    const file = await writeSiblingDraft(spec.path, md);
    return c.json({ path: path.relative(entry.root, file).split(path.sep).join('/') });
  });

  app.post('/api/projects/:pid/specs', async (c) => {
    const b = await readJson(c);
    const title = requireString(b, 'title');
    if (title.trim() === '') throw new HttpError(400, 'Title is required');
    const description = requireString(b, 'description');
    if (typeof b.draft !== 'boolean') throw new HttpError(400, 'Missing or invalid "draft"');
    const entry = await project(c);
    const spec = await createSpec(entry.root, { title, description, draft: b.draft });
    return c.json({ spec }, 201);
  });

  app.post('/api/projects/:pid/specs/:id/archive', async (c) => {
    const entry = await project(c);
    await archiveSpec(entry.root, c.req.param('id') ?? '');
    return c.body(null, 204);
  });

  app.post('/api/projects/:pid/specs/:id/unarchive', async (c) => {
    const entry = await project(c);
    await unarchiveSpec(entry.root, c.req.param('id') ?? '');
    return c.body(null, 204);
  });

  app.onError(onError);

  return app;
}
