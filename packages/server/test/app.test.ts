import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { isAllowedRequest } from '../src/security.js';
import { Registry } from '../src/registry.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
const HOST = { Host: '127.0.0.1:4949' };
let tmp: string;
let proj: string;
let reg: Registry;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sb-app-'));
  proj = path.join(tmp, 'recipe-box');
  await fs.cp(SAMPLE, proj, { recursive: true });
  reg = new Registry(path.join(tmp, 'projects.json'));
  app = createApp({ registry: reg, port: () => 4949, webDist: null });
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('read endpoints', () => {
  it('health', async () => {
    const res = await app.request('/api/health', { headers: HOST });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, app: 'specboard' });
  });

  it('lists projects with progress counting archived as done', async () => {
    const entry = await reg.add(proj);
    const res = await app.request('/api/projects', { headers: HOST });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: entry.id, name: entry.name, root: entry.root, progress: { done: 3, total: 9 } });
  });

  it('returns a project with sorted specs and nextId, 404 for unknown', async () => {
    const entry = await reg.add(proj);
    const res = await app.request(`/api/projects/${entry.id}`, { headers: HOST });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: unknown; project: { specs: Array<{ id: string }>; archived: unknown[] }; nextId: string };
    expect(body.entry).toEqual(entry);
    expect(body.project.specs).toHaveLength(8);
    const ids = body.project.specs.map((s) => s.id);
    expect(ids).toEqual([...ids].sort());
    expect(body.nextId).toBe('T-109');
    const miss = await app.request('/api/projects/deadbeef', { headers: HOST });
    expect(miss.status).toBe(404);
  });
});

describe('guard', () => {
  it('rejects a foreign Host', async () => {
    const res = await app.request('/api/health', { headers: { Host: 'evil.com' } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('rejects a Host with the wrong port or none', async () => {
    expect((await app.request('/api/health', { headers: { Host: '127.0.0.1:1' } })).status).toBe(403);
    expect((await app.request('/api/health', { headers: { Host: '127.0.0.1' } })).status).toBe(403);
  });

  it('rejects a POST from a foreign Origin', async () => {
    const res = await app.request('/api/nothing', { method: 'POST', headers: { ...HOST, Origin: 'http://evil.com' } });
    expect(res.status).toBe(403);
  });

  it('lets a POST with the board origin through the guard', async () => {
    const res = await app.request('/api/nothing', { method: 'POST', headers: { ...HOST, Origin: 'http://127.0.0.1:4949' } });
    expect(res.status).toBe(404);
  });

  it('lets a GET with no Origin through', async () => {
    expect((await app.request('/api/health', { headers: { Host: 'localhost:4949' } })).status).toBe(200);
  });

  it('isAllowedRequest', () => {
    expect(isAllowedRequest('127.0.0.1:4949', undefined, 'GET', 4949)).toBe(true);
    expect(isAllowedRequest('localhost:4949', 'http://localhost:4949', 'DELETE', 4949)).toBe(true);
    expect(isAllowedRequest(undefined, undefined, 'GET', 4949)).toBe(false);
    expect(isAllowedRequest('127.0.0.1:4949.evil.com', undefined, 'GET', 4949)).toBe(false);
    expect(isAllowedRequest('127.0.0.1:4949', 'http://127.0.0.1:4949.evil.com', 'PUT', 4949)).toBe(false);
    expect(isAllowedRequest('127.0.0.1:4949', 'https://127.0.0.1:4949', 'PATCH', 4949)).toBe(false);
    expect(isAllowedRequest('127.0.0.1:4949', 'null', 'POST', 4949)).toBe(false);
    // Origin is only enforced for mutating methods
    expect(isAllowedRequest('127.0.0.1:4949', 'http://evil.com', 'GET', 4949)).toBe(true);
  });

  it('enforces Origin on WebSocket upgrades even though they are GETs', () => {
    const up = { upgrade: true };
    expect(isAllowedRequest('127.0.0.1:4949', 'http://evil.com', 'GET', 4949, up)).toBe(false);
    expect(isAllowedRequest('127.0.0.1:4949', 'http://127.0.0.1:4949', 'GET', 4949, up)).toBe(true);
    expect(isAllowedRequest('localhost:4949', undefined, 'GET', 4949, up)).toBe(true);
    expect(isAllowedRequest('evil.com', undefined, 'GET', 4949, up)).toBe(false);
  });
});

describe('static files', () => {
  it('serves webDist with index.html fallback', async () => {
    const dist = path.join(tmp, 'dist');
    await fs.mkdir(dist);
    await fs.writeFile(path.join(dist, 'index.html'), '<html>board</html>');
    await fs.writeFile(path.join(dist, 'a.js'), 'x=1');
    const a = createApp({ registry: reg, port: () => 4949, webDist: dist });
    const js = await a.request('/a.js', { headers: HOST });
    expect(js.status).toBe(200);
    expect(await js.text()).toBe('x=1');
    const spa = await a.request('/some/route', { headers: HOST });
    expect(await spa.text()).toBe('<html>board</html>');
    await reg.add(proj);
    // Traversal must not read outside webDist: it falls back to index.html instead of leaking projects.json.
    const evil = await a.request('/..%2fprojects.json', { headers: HOST });
    expect(await evil.text()).toBe('<html>board</html>');
  });
});
