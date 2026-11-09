import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { Registry } from '../src/registry.js';
import { openInVsCode, type FileOpener } from '../src/routes/files.js';
import { fakeRuns, tempApproved } from './fakeRuns.js';

const HEADERS = { Host: '127.0.0.1:4949', 'Content-Type': 'application/json' };
let tmp: string;
let proj: string;
let pid: string;
let open: ReturnType<typeof vi.fn<FileOpener>>;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'sb-open-')));
  proj = path.join(tmp, 'proj');
  await fs.mkdir(path.join(proj, 'src'), { recursive: true });
  await fs.writeFile(path.join(proj, 'src', 'a.ts'), 'x');
  await fs.writeFile(path.join(tmp, 'outside.txt'), 'x');
  const reg = new Registry(path.join(tmp, 'projects.json'));
  pid = (await reg.add(proj)).id;
  open = vi.fn<FileOpener>(async () => true);
  app = createApp({ registry: reg, port: () => 4949, webDist: null, runs: fakeRuns(), approved: tempApproved(tmp), openFile: open });
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const post = (rel: unknown, headers: Record<string, string> = HEADERS) =>
  app.request(`/api/projects/${encodeURIComponent(pid)}/open-file`, { method: 'POST', headers, body: JSON.stringify({ path: rel }) });

describe('POST open-file', () => {
  it('opens a file of any type inside the project, by full path, and leaves out registered projects', async () => {
    const res = await post('src/a.ts');
    expect(await res.json()).toEqual({ opened: true, path: path.join(proj, 'src', 'a.ts') });
    expect(open).toHaveBeenCalledWith(path.join(proj, 'src', 'a.ts'), [proj]);
  });

  it('hands back the full path when there is no editor', async () => {
    open.mockResolvedValue(false);
    expect(await (await post('src/a.ts')).json()).toEqual({ opened: false, path: path.join(proj, 'src', 'a.ts'), reason: 'no-editor' });
  });

  it('says a missing file is missing and does not try to open it', async () => {
    expect(await (await post('src/gone.ts')).json()).toEqual({ opened: false, path: path.join(proj, 'src', 'gone.ts'), reason: 'missing' });
    expect(open).not.toHaveBeenCalled();
  });

  it('does not treat a folder as a file', async () => {
    expect(await (await post('src')).json()).toMatchObject({ opened: false, reason: 'missing' });
    expect(open).not.toHaveBeenCalled();
  });

  it.each(['../outside.txt', 'C:\\Windows\\win.ini', '/etc/passwd', '\\\\host\\share\\a.txt', 'src/\0a.ts'])('refuses %s', async (rel) => {
    expect((await post(rel)).status).toBe(400);
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses a link that leads out of the project', async () => {
    try {
      await fs.symlink(path.join(tmp, 'outside.txt'), path.join(proj, 'link.txt'));
    } catch {
      return; // creating links can need extra rights on Windows
    }
    expect((await post('link.txt')).status).toBe(400);
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses another site and an unknown project', async () => {
    expect((await post('src/a.ts', { ...HEADERS, Origin: 'https://evil.example' })).status).toBe(403);
    const res = await app.request('/api/projects/nope/open-file', { method: 'POST', headers: HEADERS, body: JSON.stringify({ path: 'a' }) });
    expect(res.status).toBe(404);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('openInVsCode', () => {
  const realPath = process.env.PATH;
  afterEach(() => {
    process.env.PATH = realPath;
  });

  it('is false when `code` is only inside a registered project', async () => {
    await fs.writeFile(path.join(proj, process.platform === 'win32' ? 'code.cmd' : 'code'), '', { mode: 0o755 });
    process.env.PATH = proj;
    expect(await openInVsCode(path.join(proj, 'src', 'a.ts'), [proj])).toBe(false);
  });

  it('is false when there is no `code` at all', async () => {
    process.env.PATH = path.join(tmp, 'empty');
    expect(await openInVsCode(path.join(proj, 'src', 'a.ts'), [])).toBe(false);
  });

  it.runIf(process.platform === 'win32')('passes a file name with shell characters as one plain argument', async () => {
    const bin = path.join(tmp, 'bin');
    const out = path.join(tmp, 'args.txt');
    await fs.mkdir(bin);
    await fs.writeFile(path.join(bin, 'code.cmd'), `@echo off\r\n> "${out}" echo [%*]\r\n`);
    const file = path.join(proj, 'a & calc (1) %PATH%.ts');
    await fs.writeFile(file, 'x');
    const sys32 = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
    process.env.PATH = `${bin};${sys32}`;
    expect(await openInVsCode(file, [proj])).toBe(true);
    await vi.waitFor(async () => expect(await fs.readFile(out, 'utf8')).toContain(file), { timeout: 5000 });
    expect(execFileSync('tasklist', ['/FI', 'IMAGENAME eq calc.exe']).toString()).not.toMatch(/^calc\.exe/m);
  });
});
