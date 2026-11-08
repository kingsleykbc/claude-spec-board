import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashText, loadProject } from '@specboard/core';
import { createApp } from '../src/app.js';
import { Registry } from '../src/registry.js';
import { PathError, safeProjectPath } from '../src/safePath.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
const HEADERS = { Host: '127.0.0.1:4949', 'Content-Type': 'application/json' };
let tmp: string;
let proj: string;
let pid: string;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sb-refs-'));
  proj = path.join(tmp, 'recipe-box');
  await fs.cp(SAMPLE, proj, { recursive: true });
  const reg = new Registry(path.join(tmp, 'projects.json'));
  pid = (await reg.add(proj)).id;
  app = createApp({ registry: reg, port: () => 4949, webDist: null });
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const send = (method: string, url: string, body?: unknown) =>
  app.request(`/api/projects/${pid}${url}`, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
const configText = () => fs.readFile(path.join(proj, '.specboard', 'config.md'), 'utf8');
const refs = async () => (await loadProject(proj)).config?.references ?? [];

const BAD = ['../../secrets.md', 'C:\\Windows\\x.md', 'C:/Windows/x.md', '/etc/passwd', 'docs/../../x.md', '\\\\server\\share\\x.md', '//server/share/x.md', 'docs/a\0.md', 'docs/x.txt'];

describe('safeProjectPath', () => {
  it.each(BAD)('rejects %j', (p) => {
    expect(() => safeProjectPath(proj, p)).toThrow(PathError);
  });
  it('accepts nested and backslash paths and returns an absolute path', () => {
    expect(safeProjectPath(proj, 'docs/API-NOTES.md')).toBe(path.join(proj, 'docs', 'API-NOTES.md'));
    expect(safeProjectPath(proj, 'docs\\API-NOTES.MD')).toBe(path.join(proj, 'docs', 'API-NOTES.MD'));
  });
  it('rejects a symlink that escapes the root', async (ctx) => {
    const outside = path.join(tmp, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'x.md'), 'x');
    try {
      await fs.symlink(outside, path.join(proj, 'link'), 'junction');
    } catch {
      return ctx.skip();
    }
    expect(() => safeProjectPath(proj, 'link/x.md')).toThrow(PathError);
  });
});

describe('references', () => {
  it('rejects unsafe link and create paths and leaves config unchanged', async () => {
    const before = await configText();
    for (const p of BAD) {
      expect((await send('POST', '/references/link', { path: p })).status, p).toBe(400);
      expect((await send('POST', '/references/create', { name: p })).status, p).toBe(400);
    }
    expect(await configText()).toBe(before);
  });

  it('lists the sample references in order, none missing', async () => {
    const res = await send('GET', '/references');
    expect(res.status).toBe(200);
    const list = (await res.json()) as { name: string; path: string; md: string; hash: string; missing: boolean }[];
    expect(list.map((r) => r.path)).toEqual(await refs());
    expect(list).toHaveLength(5);
    expect(list.every((r) => !r.missing)).toBe(true);
    expect(list[1]!.name).toBe('CONTEXT.md');
    expect(list[1]!.hash).toBe(hashText(list[1]!.md));
  });

  it('flags a missing file', async () => {
    await fs.rm(path.join(proj, 'docs', 'RULES.md'));
    const list = (await (await send('GET', '/references')).json()) as { path: string; missing: boolean }[];
    expect(list.find((r) => r.path === 'docs/RULES.md')!.missing).toBe(true);
  });

  it('unlinks without deleting the file; unknown path is 404', async () => {
    const res = await send('DELETE', `/references?path=${encodeURIComponent('docs/STYLE-GUIDE.md')}`);
    expect(res.status).toBe(204);
    expect(await refs()).toHaveLength(4);
    await fs.access(path.join(proj, 'docs', 'STYLE-GUIDE.md'));
    expect((await send('DELETE', `/references?path=${encodeURIComponent('docs/STYLE-GUIDE.md')}`)).status).toBe(404);
  });

  it('links an existing file once, 404 for a missing file', async () => {
    await send('DELETE', `/references?path=${encodeURIComponent('docs/RULES.md')}`);
    expect((await send('POST', '/references/link', { path: 'docs\\RULES.md' })).status).toBe(200);
    expect((await send('POST', '/references/link', { path: 'docs/RULES.md' })).status).toBe(200);
    expect((await refs()).filter((r) => r === 'docs/RULES.md')).toHaveLength(1);
    const res = await send('POST', '/references/link', { path: 'docs/NOPE.md' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'File not found' });
  });

  it('creates docs/<NAME>.md and links it; a second create is 409', async () => {
    const res = await send('POST', '/references/create', { name: 'deploy' });
    expect(res.status).toBe(201);
    expect(await fs.readFile(path.join(proj, 'docs', 'DEPLOY.md'), 'utf8')).toBe('# DEPLOY\n\n');
    expect(await refs()).toContain('docs/DEPLOY.md');
    const again = await send('POST', '/references/create', { name: 'deploy.md' });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: 'Already exists' });
    expect((await send('POST', '/references/create', { name: 'bad name' })).status).toBe(400);
  });

  it('PUT content writes, and a stale hash is 409 with the current text', async () => {
    const file = path.join(proj, 'docs', 'RULES.md');
    const old = await fs.readFile(file, 'utf8');
    const ok = await send('PUT', '/references/content', { path: 'docs/RULES.md', hash: hashText(old), md: 'new\n' });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ hash: hashText('new\n') });
    expect(await fs.readFile(file, 'utf8')).toBe('new\n');
    const stale = await send('PUT', '/references/content', { path: 'docs/RULES.md', hash: hashText(old), md: 'other' });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ conflict: true, currentHash: hashText('new\n'), currentText: 'new\n' });
    expect(await fs.readFile(file, 'utf8')).toBe('new\n');
  });

  it('draft-copy writes a sibling draft and returns its relative path', async () => {
    const res = await send('POST', '/references/draft-copy', { path: 'docs/RULES.md', md: 'draft' });
    expect(res.status).toBe(200);
    const { path: p } = (await res.json()) as { path: string };
    expect(p).toBe('docs/RULES.draft.md');
    expect(await fs.readFile(path.join(proj, p), 'utf8')).toBe('draft');
  });
});

describe('file search', () => {
  it('finds docs/API-NOTES.md and nothing under .specboard, node_modules or .git', async () => {
    for (const d of ['node_modules/pkg', '.git/x']) {
      await fs.mkdir(path.join(proj, d), { recursive: true });
      await fs.writeFile(path.join(proj, d, 'api.md'), 'x');
    }
    const res = await send('GET', '/files?q=API');
    const list = (await res.json()) as string[];
    expect(list).toContain('docs/API-NOTES.md');
    expect(list.some((p) => p.startsWith('.specboard') || p.includes('node_modules') || p.startsWith('.git'))).toBe(false);
    expect(list).toEqual([...list].sort());
  });

  it('caps depth at 6 and results at 20', async () => {
    const deep = path.join(proj, 'a', 'b', 'c', 'd', 'e', 'f', 'g');
    await fs.mkdir(deep, { recursive: true });
    await fs.writeFile(path.join(deep, 'deep.md'), 'x');
    await fs.writeFile(path.join(deep, '..', 'ok.md'), 'x');
    for (let i = 0; i < 25; i++) await fs.writeFile(path.join(proj, `bulk${String(i).padStart(2, '0')}.md`), 'x');
    expect(((await (await send('GET', '/files?q=deep')).json()) as string[])).toEqual([]);
    expect(((await (await send('GET', '/files?q=ok.md')).json()) as string[])).toEqual(['a/b/c/d/e/f/ok.md']);
    expect(((await (await send('GET', '/files?q=bulk')).json()) as string[])).toHaveLength(20);
    expect(((await (await send('GET', '/files')).json()) as string[])).toHaveLength(20);
  });
});

describe('claude stubs', () => {
  it.each(['run', 'stop', 'write-up', 'fix-file', 'refresh-overview'])('%s is a 501 stub', async (action) => {
    const res = await app.request(`/api/claude/${action}`, { method: 'POST', headers: HEADERS, body: '{}' });
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ stub: true, action });
  });
  it('unknown action is 404', async () => {
    expect((await app.request('/api/claude/nope', { method: 'POST', headers: HEADERS })).status).toBe(404);
  });
});
