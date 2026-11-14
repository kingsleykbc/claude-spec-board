import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RunManager } from '../src/claude/runs.js';
import { Registry, type ProjectEntry } from '../src/registry.js';
import { ApprovedPermissions } from '../src/setup.js';
import { fakeRuns } from './fakeRuns.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
const HOST = { Host: '127.0.0.1:4949' };

let tmp: string;
let entry: ProjectEntry;
let app: ReturnType<typeof createApp>;
const file = () => path.join(entry.root, '.specboard', 'sync-proposal.md');
const url = () => `/api/projects/${entry.id}/sync-proposal`;
const get = (u = url()) => app.request(u, { headers: HOST });
const del = (u = url()) => app.request(u, { method: 'DELETE', headers: { ...HOST, 'Content-Type': 'application/json' } });

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'sb-sync-routes-')));
  const root = path.join(tmp, 'recipe-box');
  await fs.cp(SAMPLE, root, { recursive: true });
  const reg = new Registry(path.join(tmp, 'projects.json'));
  entry = await reg.add(root);
  app = createApp({ registry: reg, port: () => 4949, webDist: null, runs: fakeRuns() as RunManager, approved: new ApprovedPermissions(path.join(tmp, 'permissions.json')) });
});
afterEach(() => fs.rm(tmp, { recursive: true, force: true }));

describe('sync proposal routes', () => {
  it('says there is none', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ exists: false });
  });

  it('reads the front matter and the body', async () => {
    await fs.writeFile(file(), '---\ncreated: "2026-11-14 10:00"\nhead: "a1b2c3d"\nscope: T-104\nchanges: 3\n---\n\n## Summary\nThree.\n');
    expect(await (await get()).json()).toEqual({
      exists: true, head: 'a1b2c3d', changes: 3, created: '2026-11-14 10:00', scope: 'T-104', bodyMd: '\n## Summary\nThree.\n', problems: [],
    });
  });

  it('a whole-project proposal has no scope', async () => {
    await fs.writeFile(file(), '---\nhead: "a1b2c3d"\nchanges: 0\n---\nThe board already matches the code.\n');
    expect(await (await get()).json()).toMatchObject({ exists: true, scope: null, created: null, changes: 0 });
  });

  it('broken front matter gives problems, null fields and the body', async () => {
    await fs.writeFile(file(), '---\nhead: [oops\n---\n\n## Summary\nStill here.\n');
    const body = (await (await get()).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ exists: true, head: null, changes: null, created: null, scope: null, bodyMd: '\n## Summary\nStill here.\n' });
    expect((body.problems as string[]).length).toBeGreaterThan(0);

    await fs.writeFile(file(), '## Summary\nNo front matter.\n');
    const none = (await (await get()).json()) as Record<string, unknown>;
    expect(none.bodyMd).toBe('## Summary\nNo front matter.\n');
    expect((none.problems as string[]).length).toBeGreaterThan(0);
  });

  it('deletes the file, and again without error', async () => {
    await fs.writeFile(file(), '---\nhead: x\n---\n');
    expect((await del()).status).toBe(204);
    await expect(fs.access(file())).rejects.toThrow();
    expect((await del()).status).toBe(204);
    expect(await (await get()).json()).toEqual({ exists: false });
  });

  it('answers 404 for an unknown project', async () => {
    expect((await get('/api/projects/deadbeef/sync-proposal')).status).toBe(404);
    expect((await del('/api/projects/deadbeef/sync-proposal')).status).toBe(404);
  });
});
