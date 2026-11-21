import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { fakeRuns, tempApproved } from './fakeRuns.js';
import { Registry } from '../src/registry.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
const HEADERS = { Host: '127.0.0.1:4949', 'Content-Type': 'application/json' };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const BS = String.fromCharCode(92);
const MAX = 10 * 1024 * 1024;
let tmp: string;
let proj: string;
let pid: string;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sb-up-'));
  proj = path.join(tmp, 'recipe-box');
  await fs.cp(SAMPLE, proj, { recursive: true });
  const reg = new Registry(path.join(tmp, 'projects.json'));
  pid = (await reg.add(proj)).id;
  app = createApp({ registry: reg, port: () => 4949, webDist: null, runs: fakeRuns(), approved: tempApproved(tmp) });
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const specDir = () => path.join(proj, '.specboard', 'specs', 'T-101-recipe-list-page');
const post = (name: unknown, data: unknown, id = 'T-101') =>
  app.request(`/api/projects/${pid}/specs/${id}/images`, { method: 'POST', headers: HEADERS, body: JSON.stringify({ name, data }) });
const b64 = (b: Buffer) => b.toString('base64');

describe('POST /api/projects/:pid/specs/:id/images', () => {
  it('saves the image and answers with its relative path', async () => {
    const res = await post('login.png', b64(PNG));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ path: 'images/login.png' });
    expect((await fs.readFile(path.join(specDir(), 'images', 'login.png'))).equals(PNG)).toBe(true);
  });

  it.each([
    ['Screen Shot 1.PNG', 'images/screen-shot-1.png'],
    ['.png', 'images/image.png'],
    ['a/../b.png', 'images/b.png'],
    [`a${BS}..${BS}c.png`, 'images/c.png'],
  ])('cleans the name %j to %j', async (name, want) => {
    const res = await post(name, b64(PNG));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { path: string }).path).toBe(want);
  });

  it('never overwrites: later uploads get -2, -3', async () => {
    const paths: string[] = [];
    for (let i = 0; i < 3; i++) paths.push(((await (await post('x.png', b64(PNG))).json()) as { path: string }).path);
    expect(paths).toEqual(['images/x.png', 'images/x-2.png', 'images/x-3.png']);
  });

  it.each(['run.exe', 'noext', 'x.png.exe', 'pic.'])('rejects %j with 400', async (name) => {
    expect((await post(name, b64(PNG))).status).toBe(400);
  });

  it('accepts exactly 10 MB and rejects one byte more with 413', async () => {
    expect((await post('big.png', b64(Buffer.alloc(MAX)))).status).toBe(201);
    expect((await post('bigger.png', b64(Buffer.alloc(MAX + 1)))).status).toBe(413);
  });

  it('answers 404 for an unknown spec and 409 for an archived one', async () => {
    expect((await post('a.png', b64(PNG), 'T-999')).status).toBe(404);
    expect((await post('a.png', b64(PNG), 'T-100')).status).toBe(409);
  });

  it.each([['!!!not base64!!!'], ['abc'], ['']])('rejects bad base64 %j with 400', async (data) => {
    expect((await post('a.png', data)).status).toBe(400);
  });

  it('rejects a missing name or data with 400', async () => {
    expect((await post(undefined, b64(PNG))).status).toBe(400);
    expect((await post('a.png', 5)).status).toBe(400);
  });

  it('rejects a non-JSON content type with 415', async () => {
    const res = await app.request(`/api/projects/${pid}/specs/T-101/images`, { method: 'POST', headers: { Host: HEADERS.Host, 'Content-Type': 'text/plain' }, body: 'x' });
    expect(res.status).toBe(415);
  });
});
