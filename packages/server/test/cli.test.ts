import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli.js';
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
  it('defaults', () => {
    expect(parseArgs([])).toEqual({ path: process.cwd(), port: 4949, open: true });
  });
  it('reads a path, --port and --no-open', () => {
    expect(parseArgs(['some/dir', '--port', '5050', '--no-open'])).toEqual({ path: 'some/dir', port: 5050, open: false });
  });
  it('rejects a bad port', () => {
    expect(() => parseArgs(['--port', 'abc'])).toThrow('Invalid port');
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
    expect(await res.json()).toEqual({ ok: true, app: 'specboard' });
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

  it('rejects a folder without .specboard', async () => {
    const empty = path.join(tmp, 'empty');
    await fs.mkdir(empty);
    await expect(start({ path: empty, port: await freePort(), open: false })).rejects.toThrow(
      `No .specboard folder in ${path.resolve(empty)}. Run the Claude Code /create-spec command or "specboard init" (coming in M3).`,
    );
  });
});
