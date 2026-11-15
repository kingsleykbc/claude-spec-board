import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { fakeRuns, tempApproved } from './fakeRuns.js';
import { Registry } from '../src/registry.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
const HEADERS = { Host: '127.0.0.1:4949' };
const BS = String.fromCharCode(92);
const PNG =Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
let tmp: string;
let proj: string;
let pid: string;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sb-img-'));
  proj = path.join(tmp, 'recipe-box');
  await fs.cp(SAMPLE, proj, { recursive: true });
  const dir = path.join(proj, '.specboard', 'specs', 'T-001-x', 'images');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'a.png'), PNG);
  await fs.writeFile(path.join(dir, 'my shot.PNG'), PNG);
  await fs.writeFile(path.join(dir, 'v.svg'), SVG);
  await fs.writeFile(path.join(tmp, 'outside.png'), PNG);
  const reg = new Registry(path.join(tmp, 'projects.json'));
  pid = (await reg.add(proj)).id;
  app = createApp({ registry: reg, port: () => 4949, webDist: null, runs: fakeRuns(), approved: tempApproved(tmp) });
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const get = (p: string, id = pid) => app.request(`/api/projects/${id}/image?path=${encodeURIComponent(p)}`, { headers: HEADERS });

describe('GET /api/projects/:pid/image', () => {
  it('serves a png from under .specboard with its type and bytes', async () => {
    const res = await get('.specboard/specs/T-001-x/images/a.png');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('serves a file whose name has a space and an upper-case extension', async () => {
    const res = await get('.specboard/specs/T-001-x/images/my shot.PNG');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it.each(['../outside.png', 'C:/x.png', `${BS}${BS}host${BS}x.png`, '/etc/x.png', '.specboard/../../outside.png'])('rejects %j with 400', async (p) => {
    expect((await get(p)).status).toBe(400);
  });

  it.each(['.specboard/specs/T-101-recipe-list-page/spec.md', '.specboard/config.md', 'package.json'])('rejects non-image %j with 400', async (p) => {
    const res = await get(p);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).not.toMatch(/^image\//);
  });

  it('rejects a missing path with 400', async () => {
    const res = await app.request(`/api/projects/${pid}/image`, { headers: HEADERS });
    expect(res.status).toBe(400);
  });

  it('gives 404 for a missing image', async () => {
    expect((await get('.specboard/specs/T-001-x/images/none.png')).status).toBe(404);
  });

  it('gives 404 for a folder named like an image', async () => {
    await fs.mkdir(path.join(proj, '.specboard', 'specs', 'T-001-x', 'images', 'd.png'));
    expect((await get('.specboard/specs/T-001-x/images/d.png')).status).toBe(404);
  });

  it('sandboxes svg', async () => {
    const res = await get('.specboard/specs/T-001-x/images/v.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(res.headers.get('content-security-policy')).toBe('sandbox');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('gives 404 for an unknown project', async () => {
    expect((await get('.specboard/specs/T-001-x/images/a.png', 'nope')).status).toBe(404);
  });

  it('refuses a foreign Host like the other routes', async () => {
    const res = await app.request(`/api/projects/${pid}/image?path=x.png`, { headers: { Host: 'evil.example' } });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
