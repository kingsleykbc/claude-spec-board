import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveCommand, detachArgs, parseArchiveArgs, parseArgs, parseInitArgs, runDetached, shutdown } from '../src/cli.js';
import { loadProject } from '@specboard/core';
import { start } from '../src/start.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');

let tmp: string;
let home: string;
const closers: Array<() => Promise<void>> = [];
const blockers: net.Server[] = [];
let savedHome: string | undefined;

async function freePort(): Promise<number> {
  const s = net.createServer();
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const p = (s.address() as net.AddressInfo).port;
  await new Promise((r) => s.close(r));
  return p;
}

async function copySample(name: string): Promise<string> {
  const dest = path.join(tmp, name);
  await fs.cp(SAMPLE, dest, { recursive: true });
  return dest;
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-cli-'));
  home = path.join(tmp, 'home');
  savedHome = process.env.SPECBOARD_HOME;
  process.env.SPECBOARD_HOME = home;
});

afterEach(async () => {
  for (const c of closers.splice(0)) await c();
  for (const b of blockers.splice(0)) await new Promise((r) => b.close(r));
  if (savedHome === undefined) delete process.env.SPECBOARD_HOME;
  else process.env.SPECBOARD_HOME = savedHome;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('parseArgs', () => {
  let savedInit: string | undefined;
  beforeEach(() => {
    savedInit = process.env.INIT_CWD;
    delete process.env.INIT_CWD;
  });
  afterEach(() => {
    if (savedInit === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = savedInit;
  });
  it('treats an empty INIT_CWD as unset', () => {
    process.env.INIT_CWD = '';
    expect(parseArgs([]).path).toBe(process.cwd());
  });
  it('defaults', () => {
    expect(parseArgs([])).toEqual({ path: process.cwd(), port: 4949, open: true, detach: false });
  });
  it('defaults the path to INIT_CWD when set', () => {
    process.env.INIT_CWD = path.join(os.tmpdir(), 'initcwd');
    expect(parseArgs([]).path).toBe(path.join(os.tmpdir(), 'initcwd'));
  });
  it('reads a path, --port and --no-open', () => {
    expect(parseArgs(['some/dir', '--port', '5050', '--no-open'])).toEqual({ path: path.resolve(process.cwd(), 'some/dir'), port: 5050, open: false, detach: false });
  });
  it('reads --detach and --no-detach', () => {
    expect(parseArgs(['--detach']).detach).toBe(true);
    expect(parseArgs(['--detach', '--no-detach']).detach).toBe(false);
  });
  it('resolves a relative path argument against INIT_CWD (npm runs scripts from the repo root)', () => {
    const init = path.join(os.tmpdir(), 'initcwd');
    process.env.INIT_CWD = init;
    expect(parseArgs(['examples/recipe-box']).path).toBe(path.join(init, 'examples', 'recipe-box'));
    expect(parseArgs(['..']).path).toBe(os.tmpdir());
    const abs = path.join(os.tmpdir(), 'elsewhere');
    expect(parseArgs([abs]).path).toBe(abs);
  });
  it('resolves a relative path argument against cwd when INIT_CWD is unset', () => {
    expect(parseArgs(['some/dir']).path).toBe(path.join(process.cwd(), 'some', 'dir'));
  });
  it('rejects a bad port', () => {
    expect(() => parseArgs(['--port', 'abc'])).toThrow('Invalid port');
  });
});

describe('parseInitArgs', () => {
  it('reads --no-skills and --runs', () => {
    const a = parseInitArgs(['--no-skills', '--runs', 'yes']);
    expect(a.noSkills).toBe(true);
    expect(a.runs).toBe('yes');
    expect(parseInitArgs([]).noSkills).toBe(false);
    expect(parseInitArgs([]).runs).toBeUndefined();
    expect(parseInitArgs(['--runs', 'no']).runs).toBe('no');
  });
  it('rejects a bad --runs value', () => {
    expect(() => parseInitArgs(['--runs', 'maybe'])).toThrow('--runs needs yes or no');
    expect(() => parseInitArgs(['--runs'])).toThrow('--runs needs yes or no');
  });
});

describe('detach', () => {
  it('detachArgs drops --detach and adds --no-detach once', () => {
    expect(detachArgs(['proj', '--detach', '--port', '5050'])).toEqual(['proj', '--port', '5050', '--no-detach']);
    expect(detachArgs(['--no-detach', '--detach'])).toEqual(['--no-detach']);
  });

  it('with a board already running: registers the project and returns 0 without spawning', async () => {
    const proj = await copySample('a');
    const fake = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, app: 'specboard' }));
    });
    await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
    blockers.push(fake);
    const port = (fake.address() as net.AddressInfo).port;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const spawned = vi.fn();
    expect(await runDetached({ path: proj, port, open: false }, [proj, '--detach'], { spawn: spawned })).toBe(0);
    expect(spawned).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(`Spec Board running at http://127.0.0.1:${port}`);
    log.mockRestore();
    const registry = JSON.parse(await fs.readFile(path.join(home, 'projects.json'), 'utf8'));
    expect(JSON.stringify(registry)).toContain(path.basename(proj));
  });

  it('refuses without spawning when another program holds the port', async () => {
    const proj = await copySample('c');
    const blocker = net.createServer((sock) => sock.destroy());
    await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
    blockers.push(blocker);
    const port = (blocker.address() as net.AddressInfo).port;
    const spawned = vi.fn();
    await expect(runDetached({ path: proj, port, open: false }, [proj], { spawn: spawned })).rejects.toThrow(`Port ${port} is in use by another program`);
    expect(spawned).not.toHaveBeenCalled();
  });

  it('rejects --port 0 before anything else', async () => {
    await expect(runDetached({ path: path.join(tmp, 'nope'), port: 0, open: false }, [], { spawn: vi.fn() })).rejects.toThrow('fixed port');
  });

  it('stops waiting when the child has exited', async () => {
    const proj = await copySample('d');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t0 = Date.now();
    expect(await runDetached({ path: proj, port: await freePort(), open: false }, [proj], { spawn: () => ({ exited: () => true }), timeoutMs: 5000 })).toBe(1);
    expect(Date.now() - t0).toBeLessThan(2000);
    err.mockRestore();
  });

  it('returns 1 when the child never answers', async () => {
    const proj = await copySample('b');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const spawned = vi.fn();
    expect(await runDetached({ path: proj, port: await freePort(), open: false }, [proj], { spawn: spawned, timeoutMs: 300 })).toBe(1);
    expect(spawned).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('--version', () => {
  it('prints the plugin.json version', async () => {
    const cli = path.resolve(import.meta.dirname, '../src/cli.ts');
    const r = spawnSync(process.execPath, ['--import', 'tsx', cli, '--version'], { encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..') });
    const manifest = JSON.parse(await fs.readFile(path.resolve(import.meta.dirname, '../../../plugin/.claude-plugin/plugin.json'), 'utf8'));
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(manifest.version);
  });
});

describe('start', () => {
  it('serves a project and reports health', async () => {
    const proj = await copySample('a');
    const port = await freePort();
    const s = await start({ path: proj, port, open: false });
    closers.push(s.close);
    expect(s.url).toBe(`http://127.0.0.1:${port}`);
    const res = await fetch(`${s.url}/api/health`);
    expect(await res.json()).toEqual({ ok: true, app: 'specboard', plugin: false });
    const projects = (await (await fetch(`${s.url}/api/projects`)).json()) as Array<{ root: string }>;
    expect(projects.map((p) => p.root)).toEqual([path.resolve(proj)]);
  });

  it('a second start on the same port reuses the running server and registers the project', async () => {
    const a = await copySample('a');
    const b = await copySample('b');
    const port = await freePort();
    const first = await start({ path: a, port, open: false });
    closers.push(first.close);
    const second = await start({ path: b, port, open: false });
    closers.push(second.close);
    expect(second.url).toBe(first.url);
    const projects = (await (await fetch(`${first.url}/api/projects`)).json()) as Array<{ root: string }>;
    expect(projects.map((p) => p.root).sort()).toEqual([path.resolve(a), path.resolve(b)].sort());
  });

  it('falls back to a free port when another program holds the port', async () => {
    const proj = await copySample('a');
    const blocker = net.createServer((sock) => sock.destroy());
    await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
    blockers.push(blocker);
    const busy = (blocker.address() as net.AddressInfo).port;
    const s = await start({ path: proj, port: busy, open: false });
    closers.push(s.close);
    expect(s.url).not.toBe(`http://127.0.0.1:${busy}`);
    expect((await fetch(`${s.url}/api/health`)).ok).toBe(true);
  });

  it('keeps running when the browser cannot be opened', async () => {
    const proj = await copySample('a');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = await start({ path: proj, port: await freePort(), open: true, opener: async () => { throw new Error('no browser'); } });
    closers.push(s.close);
    expect((await fetch(`${s.url}/api/health`)).ok).toBe(true);
    expect(err).toHaveBeenCalledWith(`Could not open a browser. Open ${s.url} yourself.`);
    err.mockRestore();
  });

  it('rejects a folder without .specboard', async () => {
    const empty = path.join(tmp, 'empty');
    await fs.mkdir(empty);
    await expect(start({ path: empty, port: await freePort(), open: false })).rejects.toThrow(
      `No .specboard folder in ${path.resolve(empty)}. Run \`specboard init\` in a terminal. Until Spec Board is published, run it from the Spec Board repo as \`npm run specboard -- init "${path.resolve(empty)}"\`.`,
    );
  });
});

describe('shutdown', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('exits 0 after close resolves', async () => {
    const exit = vi.fn();
    shutdown(async () => {}, exit as never);
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
  });

  it('exits 1 and logs when close rejects', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.fn();
    shutdown(async () => { throw new Error('boom'); }, exit as never);
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(err).toHaveBeenCalledWith('boom');
  });

  it('exits 1 after the timeout when close hangs', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.fn();
    shutdown(() => new Promise<void>(() => {}), exit as never);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('ignores a second call', async () => {
    const close = vi.fn(async () => {});
    const exit = vi.fn();
    shutdown(close, exit as never);
    shutdown(close, exit as never);
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('tree command', () => {
  const cli = path.resolve(import.meta.dirname, '../src/cli.ts');
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', cli, 'tree', ...args], { encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..') });

  it('prints the tree, one spec, and exits 1 on unknown input', async () => {
    const dir = await copySample('tree-sample');
    const all = run(dir);
    expect(all.stderr).toBe('');
    expect(all.status).toBe(0);
    expect(all.stdout).toMatch(/^Recipe Box · \d+\/\d+ done\n/);
    expect(all.stdout).toContain('T-104 Meal planner calendar · doing');
    const one = run('--spec', 'T-104', dir);
    expect(one.status).toBe(0);
    expect(one.stdout.startsWith('T-104 Meal planner calendar · doing\n')).toBe(true);
    expect(one.stdout).not.toContain('T-101');
    const bad = run('--spec', 'T-999', dir);
    expect(bad.status).toBe(1);
    expect(bad.stderr.trim()).toBe('Unknown spec: T-999');
    const none = run(path.join(tmp, 'empty'));
    expect(none.status).toBe(1);
    expect(none.stderr.trim()).toMatch(/No \.specboard folder/);
  }, 30000);
});

describe('archive command', () => {
  const cli = path.resolve(import.meta.dirname, '../src/cli.ts');
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', cli, 'archive', ...args], { encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..') });

  it('parses the ID and an optional folder, and rejects options and bad counts', () => {
    expect(parseArchiveArgs(['T-002', '/some/dir'])).toEqual({ id: 'T-002', path: path.resolve('/some/dir') });
    expect(parseArchiveArgs(['T-002']).id).toBe('T-002');
    expect(() => parseArchiveArgs([])).toThrow(/Usage/);
    expect(() => parseArchiveArgs(['a', 'b', 'c'])).toThrow(/Usage/);
    expect(() => parseArchiveArgs(['T-1', '--force'])).toThrow('Unknown option: --force');
  });

  it('archives a spec from any status, is a no-op the second time, and exits 1 on unknown input', async () => {
    const dir = await copySample('archive-sample');
    const before = await loadProject(dir);
    const open = before.specs.find((s) => s.status !== 'done')!;
    const ok = run(open.id, dir);
    expect(ok.stderr).toBe('');
    expect([ok.status, ok.stdout.trim()]).toEqual([0, `Archived ${open.id}.`]);
    const after = await loadProject(dir);
    expect(after.specs.some((s) => s.id === open.id)).toBe(false);
    expect(after.archived.some((s) => s.id === open.id)).toBe(true);
    const again = run(open.id, dir);
    expect([again.status, again.stdout.trim()]).toEqual([0, `${open.id} is already archived.`]);
    const unknown = run('T-999', dir);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr.trim()).toBe(`No spec T-999 in ${dir}`);
    const none = run('T-001', path.join(tmp, 'empty'));
    expect(none.status).toBe(1);
    expect(none.stderr.trim()).toMatch(/No .specboard folder/);
  }, 30000);

  it('archiveCommand reports through the given writers', async () => {
    const dir = await copySample('archive-fn');
    const out: string[] = [];
    const errs: string[] = [];
    expect(await archiveCommand({ id: 'T-101', path: dir }, (m) => out.push(m), (m) => errs.push(m))).toBe(0);
    expect(await archiveCommand({ id: 'T-nope', path: dir }, (m) => out.push(m), (m) => errs.push(m))).toBe(1);
    expect(out).toEqual(['Archived T-101.']);
    expect(errs).toEqual([`No spec T-nope in ${dir}`]);
  });
});
