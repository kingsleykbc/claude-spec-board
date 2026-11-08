import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashText, loadProject } from '@specboard/core';
import type { Spec } from '@specboard/core';
import { createApp } from '../src/app.js';
import { Registry } from '../src/registry.js';

const boom = vi.hoisted(() => ({ on: false }));
vi.mock('@specboard/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@specboard/core')>();
  return {
    ...real,
    writeIfUnchanged: (...a: Parameters<typeof real.writeIfUnchanged>) => {
      if (boom.on) throw new Error('boom');
      return real.writeIfUnchanged(...a);
    },
  };
});

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
const HEADERS = { Host: '127.0.0.1:4949', 'Content-Type': 'application/json' };
let tmp: string;
let proj: string;
let pid: string;
let app: ReturnType<typeof createApp>;

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const specFile = (id: string) => path.join(proj, '.specboard', 'specs', fsName[id]!, 'spec.md');
const fsName: Record<string, string> = {};

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sb-specs-'));
  proj = path.join(tmp, 'recipe-box');
  await fs.cp(SAMPLE, proj, { recursive: true });
  const reg = new Registry(path.join(tmp, 'projects.json'));
  pid = (await reg.add(proj)).id;
  app = createApp({ registry: reg, port: () => 4949, webDist: null });
  const p = await loadProject(proj);
  for (const s of p.specs) fsName[s.id] = path.basename(s.dir);
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const send = (method: string, url: string, body?: unknown) =>
  app.request(`/api/projects/${pid}${url}`, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
const get = async (id: string): Promise<Spec> => {
  const p = await loadProject(proj);
  return [...p.specs, ...p.archived].find((s) => s.id === id)!;
};

describe('spec mutations', () => {
  it('meta sets the field and bumps updated to today', async () => {
    // Make `updated` stale first so the bump is observable.
    const file = specFile('T-101');
    const old = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, old.replace(/^updated: .*$/m, 'updated: 2020-01-01'));
    const before = await get('T-101');
    const res = await send('PATCH', '/specs/T-101/meta', { hash: before.hash, key: 'status', value: 'review' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hash: string; spec: Spec };
    const text = await fs.readFile(file, 'utf8');
    expect(text).toMatch(/^status: review$/m);
    expect(text).toContain(`updated: ${localToday()}`);
    expect(body.hash).toBe(hashText(text));
    expect(body.spec.status).toBe('review');
  });

  it('returns 409 for a stale hash and leaves the file unchanged', async () => {
    const file = specFile('T-101');
    const before = await fs.readFile(file, 'utf8');
    const res = await send('PATCH', '/specs/T-101/meta', { hash: 'stale', key: 'status', value: 'review' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ conflict: true, currentHash: hashText(before), currentText: before });
    expect(await fs.readFile(file, 'utf8')).toBe(before);
  });

  it('rejects invalid values, unknown keys and bad bodies with 400', async () => {
    const s = await get('T-101');
    const untouched = await fs.readFile(specFile('T-101'), 'utf8');
    const bad = await send('PATCH', '/specs/T-101/meta', { hash: s.hash, key: 'status', value: 'wip' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe('Invalid value for status');
    expect((await send('PATCH', '/specs/T-101/meta', { hash: s.hash, key: 'depends_on', value: [] })).status).toBe(400);
    expect((await send('PATCH', '/specs/T-101/meta', { key: 'status', value: 'done' })).status).toBe(400);
    const raw = await app.request(`/api/projects/${pid}/specs/T-101/meta`, { method: 'PATCH', headers: HEADERS, body: '{nope' });
    expect(raw.status).toBe(400);
    expect(await fs.readFile(specFile('T-101'), 'utf8')).toBe(untouched);
  });

  it('ticks a subtask', async () => {
    const s = await get('T-104');
    const res = await send('PATCH', '/specs/T-104/subtasks/3', { hash: s.hash, done: true });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { spec: Spec };
    expect(body.spec.progress).toEqual({ done: 3, total: 5 });
  });

  it('saves answers', async () => {
    const s = await get('T-105');
    const res = await send('PATCH', '/specs/T-105/answers', { hash: s.hash, answers: { Q1: 'Yes' } });
    expect(res.status).toBe(200);
    const text = await fs.readFile(specFile('T-105'), 'utf8');
    expect(text).toMatch(/Q1[^\n]*\n\s*> answer: Yes/);
    const spec = (await res.json()) as { spec: Spec };
    expect(spec.spec.questions.find((q) => q.id === 'Q1')?.answer).toBe('Yes');
  });

  it('body round-trip keeps questions and subtasks', async () => {
    const s = await get('T-105');
    const res = await send('PATCH', '/specs/T-105/body', { hash: s.hash, md: s.bodyMd + '\nExtra line.\n' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { spec: Spec };
    expect(body.spec.bodyMd).toContain('Extra line.');
    expect(body.spec.questions).toHaveLength(s.questions.length);
    expect(body.spec.subtasks).toHaveLength(s.subtasks.length);
  });

  it('draft-copy writes a sibling file and returns its relative path', async () => {
    const res = await send('POST', '/specs/T-101/draft-copy', { md: '# Draft\n' });
    expect(res.status).toBe(200);
    const { path: p } = (await res.json()) as { path: string };
    expect(p).toBe(`.specboard/specs/${fsName['T-101']}/spec.draft.md`);
    expect(await fs.readFile(path.join(proj, p), 'utf8')).toBe('# Draft\n');
  });

  it('creates a spec', async () => {
    const res = await send('POST', '/specs', { title: 'New thing', description: 'Desc', draft: true });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { spec: Spec };
    expect(body.spec.id).toBe('T-109');
    expect((await send('POST', '/specs', { title: 'x' })).status).toBe(400);
  });

  it('archives done specs only, unarchives, and 404s unknown ids', async () => {
    const open = (await loadProject(proj)).specs.find((s) => s.status !== 'done')!;
    const no = await send('POST', `/specs/${open.id}/archive`);
    expect(no.status).toBe(400);
    expect(await no.json()).toEqual({ error: 'Only done specs can be archived' });
    const done = (await loadProject(proj)).specs.find((s) => s.status === 'done')!;
    expect((await send('POST', `/specs/${done.id}/archive`)).status).toBe(204);
    expect((await get(done.id)).archived).toBe(true);
    expect((await send('POST', `/specs/${done.id}/unarchive`)).status).toBe(204);
    expect((await get(done.id)).archived).toBe(false);
    const nf = { error: 'Spec T-999 not found' };
    const r1 = await send('POST', '/specs/T-999/archive');
    expect([r1.status, await r1.json()]).toEqual([404, nf]);
    const r2 = await send('PATCH', '/specs/T-999/meta', { hash: 'h', key: 'status', value: 'done' });
    expect([r2.status, await r2.json()]).toEqual([404, nf]);
    const r3 = await send('POST', '/specs/T-999/draft-copy', { md: 'x' });
    expect([r3.status, await r3.json()]).toEqual([404, nf]);
    const r4 = await app.request('/api/projects/nope/specs', { method: 'POST', headers: HEADERS, body: JSON.stringify({ title: 't', description: '', draft: false }) });
    expect([r4.status, await r4.json()]).toEqual([404, { error: 'Unknown project' }]);
  });

  it('patches an archived spec', async () => {
    const s = await get('T-100');
    const res = await send('PATCH', '/specs/T-100/meta', { hash: s.hash, key: 'title', value: 'Renamed' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { spec: Spec }).spec.title).toBe('Renamed');
  });

  it('rejects an empty title with 400', async () => {
    for (const title of ['', '   ']) {
      const res = await send('POST', '/specs', { title, description: '', draft: false });
      expect([res.status, await res.json()]).toEqual([400, { error: 'Title is required' }]);
    }
  });

  it('maps unexpected errors to 500 and logs the stack', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const s = await get('T-101');
    boom.on = true;
    try {
      const res = await send('PATCH', '/specs/T-101/meta', { hash: s.hash, key: 'status', value: 'review' });
      expect([res.status, await res.json()]).toEqual([500, { error: 'Internal error' }]);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      boom.on = false;
      spy.mockRestore();
    }
  });
});
