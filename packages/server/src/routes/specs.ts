import path from 'node:path';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  archiveSpec,
  createSpec,
  hashText,
  loadProject,
  needsRefreshFor,
  parseSpecMeta,
  replaceSpecBody,
  specBodyMd,
  setAnswers,
  setMetaField,
  setNeedsRefresh,
  setReviewDone,
  setReviewFailed,
  setSubtaskDone,
  splitFrontMatter,
  unarchiveSpec,
  writeIfUnchanged,
  writeSettings,
  writeSiblingDraft,
} from '@specboard/core';
import type { Spec } from '@specboard/core';
import type { Registry, ProjectEntry } from '../registry.js';
import type { RunManager } from '../claude/runs.js';
import { HttpError, onError, readJson, requireString } from '../http.js';

const META_KEYS = ['status', 'urgency', 'categories', 'title', 'draft', 'current_subtask'] as const;
type MetaKey = (typeof META_KEYS)[number];

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The body changed on disk since the editor opened; thrown from inside the locked write transform. */
class BodyConflict extends Error {
  constructor(readonly currentText: string) {
    super('Spec body changed since editing started');
  }
}

function findSpec(p: { specs: Spec[]; archived: Spec[] }, id: string): Spec | undefined {
  return p.specs.find((s) => s.id === id) ?? p.archived.find((s) => s.id === id);
}

export function specRoutes(registry: Registry, runs?: RunManager): Hono {
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

  /**
   * Run a hash-checked transform, then reload and answer with the new spec. `hash` is the hash of the
   * text actually written (the reload may already see a later write by someone else).
   */
  const mutate = async (c: Context, transform: (text: string) => string, hash: string): Promise<Response> => {
    const { entry, spec } = await locate(c);
    let res;
    try {
      res = await writeIfUnchanged(spec.path, hash, transform);
    } catch (e) {
      if (e instanceof BodyConflict) return c.json({ conflict: true, currentHash: hashText(e.currentText), currentText: e.currentText }, 409);
      throw e;
    }
    if (!res.ok) return c.json({ conflict: true, currentHash: res.currentHash, currentText: res.currentText }, 409);
    const fresh = findSpec(await loadProject(entry.root), spec.id);
    if (!fresh) throw new Error(`Spec ${spec.id} missing after write`);
    return c.json({ hash: res.hash, spec: fresh });
  };

  app.patch('/api/projects/:pid/specs/:id/meta', async (c) => {
    const b = await readJson(c);
    const hash = requireString(b, 'hash', false);
    const key = b.key;
    if (typeof key !== 'string' || !(META_KEYS as readonly string[]).includes(key)) throw new HttpError(400, `Invalid key`);
    if (!('value' in b)) throw new HttpError(400, 'Missing "value"');
    // Only a clear: Claude sets the step itself, the board just lets the user drop a leftover one.
    if (key === 'current_subtask' && b.value !== null) throw new HttpError(400, 'current_subtask can only be cleared');
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

  app.patch('/api/projects/:pid/specs/:id/reviews/:n', async (c) => {
    const b = await readJson(c);
    const hash = requireString(b, 'hash', false);
    // `{hash, done}` ticks (Pass, which also clears a failed reason) or unticks; `{hash, failed}` writes or clears it.
    const hasFailed = 'failed' in b;
    if (hasFailed && 'done' in b) throw new HttpError(400, 'Send "done" or "failed", not both');
    if (hasFailed) {
      if (b.failed !== null && typeof b.failed !== 'string') throw new HttpError(400, 'Invalid "failed"');
    } else if (typeof b.done !== 'boolean') throw new HttpError(400, 'Missing or invalid "done"');
    const n = Number(c.req.param('n'));
    if (!Number.isInteger(n)) throw new HttpError(400, 'Invalid review item number');
    if (hasFailed) return mutate(c, (text) => setReviewFailed(text, n, b.failed as string | null), hash);
    return mutate(c, (text) => setReviewDone(text, n, b.done as boolean), hash);
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
    const bodyHash = requireString(b, 'bodyHash', false);
    const md = requireString(b, 'md');
    // `hash` may be newer than the edit (a status move landed meanwhile); `bodyHash` is from edit start,
    // and is checked against the locked, re-read text so a body change by anyone else is never overwritten.
    return mutate(
      c,
      (text) => {
        if (hashText(specBodyMd(text)) !== bodyHash) throw new BodyConflict(text);
        const next = replaceSpecBody(text, md);
        // An open, non-draft spec's questions may now be stale: flag it in the same write.
        const { meta } = parseSpecMeta(splitFrontMatter(next).yaml);
        // An unchanged body flags nothing (and starts no paid refresh).
        if (next === text) return text;
        return needsRefreshFor(meta) ? setNeedsRefresh(next, today()) : next;
      },
      hash,
    );
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
    const id = c.req.param('id') ?? '';
    const run = runs?.current(entry.id);
    if (run && run.status === 'running' && run.specId === id) throw new HttpError(409, 'Claude is working on it');
    await archiveSpec(entry.root, id, { anyStatus: true });
    return c.body(null, 204);
  });

  app.post('/api/projects/:pid/specs/:id/unarchive', async (c) => {
    const entry = await project(c);
    await unarchiveSpec(entry.root, c.req.param('id') ?? '');
    return c.body(null, 204);
  });

  app.put('/api/projects/:pid/settings', async (c) => {
    const entry = await project(c);
    const b = await readJson(c);
    if (typeof b.trackTokens !== 'boolean') throw new HttpError(400, 'Missing or invalid "trackTokens"');
    await writeSettings(entry.root, { trackTokens: b.trackTokens });
    return c.json({ settings: (await loadProject(entry.root)).settings });
  });

  app.onError(onError);

  return app;
}
