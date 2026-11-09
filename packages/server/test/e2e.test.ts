import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { hashText, loadProject, setMetaField, writeIfUnchanged } from '@specboard/core';
import type { Spec } from '@specboard/core';
import { approvedStore } from '../src/setup.js';
import { start, type Started } from '../src/start.js';

// End to end: the real `start()` (HTTP + WebSocket + file watcher) on a temp copy of the sample.

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
const WEB_DIST = path.resolve(import.meta.dirname, '../../web/dist');
const hasDist = fs.existsSync(path.join(WEB_DIST, 'index.html'));

let tmp: string;
let proj: string;
let savedHome: string | undefined;
let server: Started | undefined;
let ws: WebSocket | undefined;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(cond: () => boolean, ms = 3000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(15);
  }
  return cond();
}

interface Ctx {
  base: string;
  msgs: { type: string; pid?: string; runId?: string; run?: { id: string; status: string } }[];
  pid: string;
  events: () => number;
}

const FAKE = path.resolve(import.meta.dirname, 'fixtures', 'fake-claude.mjs');
const APPROVED = { allow: ['Read(./**)', 'Edit(./**)', 'Write(./**)', 'Bash(git status:*)'], deny: ['Bash(git push:*)', 'Edit(./.claude/**)'] };

async function boot(): Promise<Ctx> {
  let n = 0;
  server = await start({
    path: proj,
    port: 0,
    open: false,
    claude: {
      status: async () => ({ installed: true, loggedIn: true, version: '2.1.302' }),
      command: (args) => ({ bin: process.execPath, args: [FAKE, 'plain', path.join(tmp, `record-${++n}.json`), ...args] }),
    },
  });
  const base = server.url;
  const host = new URL(base).host;
  const projects = (await (await fetch(`${base}/api/projects`)).json()) as { id: string; root: string }[];
  const pid = projects.find((p) => path.resolve(p.root) === path.resolve(proj))!.id;

  const msgs: { type: string; pid?: string }[] = [];
  ws = new WebSocket(`ws://${host}/ws`, { headers: { Host: host } });
  ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  await new Promise<void>((res, rej) => {
    ws!.once('open', () => res());
    ws!.once('error', rej);
  });
  ws.send(JSON.stringify({ type: 'subscribe', pid }));
  await sleep(400); // let the watcher settle
  return { base, pid, msgs, events: () => msgs.filter((m) => m.type === 'project-changed' && m.pid === pid).length };
}

async function getSpec(base: string, pid: string, id: string): Promise<Spec> {
  const res = await fetch(`${base}/api/projects/${pid}`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as { project: { specs: Spec[] } };
  return body.project.specs.find((s) => s.id === id)!;
}

function patch(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

beforeEach(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'sb-e2e-'));
  proj = path.join(tmp, 'recipe-box');
  await fsp.cp(SAMPLE, proj, { recursive: true });
  savedHome = process.env.SPECBOARD_HOME;
  process.env.SPECBOARD_HOME = path.join(tmp, 'home');
});

afterEach(async () => {
  ws?.terminate();
  ws = undefined;
  await server?.close();
  server = undefined;
  if (savedHome === undefined) delete process.env.SPECBOARD_HOME;
  else process.env.SPECBOARD_HOME = savedHome;
  await fsp.rm(tmp, { recursive: true, force: true });
});

describe('end to end through start()', () => {
  it('a subtask PATCH broadcasts project-changed and GET shows 3/5', async () => {
    const { base, pid, events } = await boot();
    const before = await getSpec(base, pid, 'T-104');
    expect(before.subtasks.filter((s) => s.done).length).toBe(2);

    const res = await patch(`${base}/api/projects/${pid}/specs/T-104/subtasks/3`, { hash: before.hash, done: true });
    expect(res.status).toBe(200);
    expect(await until(() => events() > 0)).toBe(true);

    const after = await getSpec(base, pid, 'T-104');
    expect(after.subtasks.filter((s) => s.done).length).toBe(3);
    expect(after.subtasks.length).toBe(5);
  });

  it('an external core write to T-105 broadcasts project-changed', async () => {
    const { base, pid, events } = await boot();
    const spec = (await loadProject(proj)).specs.find((s) => s.id === 'T-105')!;
    expect(spec.urgency).toBe('normal');
    const text = await fsp.readFile(spec.path, 'utf8');
    const res = await writeIfUnchanged(spec.path, hashText(text), (t) => setMetaField(t, 'urgency', 'high'));
    expect(res.ok).toBe(true);
    expect(await until(() => events() > 0)).toBe(true);
    expect((await getSpec(base, pid, 'T-105')).urgency).toBe('high');
  });

  it('a stale-hash PATCH answers 409 with the current text', async () => {
    const { base, pid } = await boot();
    const spec = await getSpec(base, pid, 'T-104');
    const res = await patch(`${base}/api/projects/${pid}/specs/T-104/subtasks/3`, { hash: 'stale', done: true });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { conflict: boolean; currentHash: string; currentText: string };
    expect(body.conflict).toBe(true);
    expect(body.currentHash).toBe(spec.hash);
    expect(body.currentText).toContain('Persist planned meals');
  });

  it.skipIf(!hasDist)('GET / serves the built index.html', async () => {
    const { base } = await boot();
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toBe(await fsp.readFile(path.join(WEB_DIST, 'index.html'), 'utf8'));
  });

  it('streams run events, in order, to subscribers of that project only', async () => {
    const { base, pid, msgs } = await boot();
    await approvedStore().set(pid, fs.realpathSync(proj), APPROVED);

    // A second client that is not subscribed to this project.
    const host = new URL(base).host;
    const quiet: { type: string }[] = [];
    const other = new WebSocket(`ws://${host}/ws`, { headers: { Host: host } });
    other.on('message', (d) => quiet.push(JSON.parse(String(d))));
    await new Promise<void>((res, rej) => { other.once('open', () => res()); other.once('error', rej); });
    other.send(JSON.stringify({ type: 'subscribe', pid: 'someone-else' }));

    const res = await fetch(`${base}/api/projects/${pid}/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'refresh-overview' }) });
    expect(res.status).toBe(202);
    const { run } = (await res.json()) as { run: { id: string } };
    expect(await until(() => msgs.some((m) => m.type === 'run-ended'), 15000)).toBe(true);
    other.terminate();

    const runMsgs = msgs.filter((m) => m.type.startsWith('run-'));
    expect(runMsgs[0]!.type).toBe('run-started');
    expect(runMsgs.at(-1)!.type).toBe('run-ended');
    expect(runMsgs.slice(1, -1).every((m) => m.type === 'run-line' && m.runId === run.id)).toBe(true);
    expect(runMsgs.filter((m) => m.type === 'run-started')).toHaveLength(1);
    expect(runMsgs.at(-1)!.run).toMatchObject({ id: run.id, status: 'finished' });
    expect(quiet.some((m) => m.type.startsWith('run-'))).toBe(false);

    const state = (await (await fetch(`${base}/api/projects/${pid}/run`)).json()) as { run: { id: string }; approved: boolean };
    expect(state.run.id).toBe(run.id);
    expect(state.approved).toBe(true);
  });
});
