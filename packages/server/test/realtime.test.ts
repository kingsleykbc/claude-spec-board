import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { hashText, loadProject, setMetaField, writeIfUnchanged } from '@specboard/core';
import { attachRealtime } from '../src/app.js';
import { fakeRuns, tempApproved } from './fakeRuns.js';
import { Registry } from '../src/registry.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');

let tmp: string;
let proj: string;
let pid: string;
let registry: Registry;
let server: http.Server;
let port: number;
let runs: ReturnType<typeof fakeRuns>;
let rt: Awaited<ReturnType<typeof attachRealtime>>;
const sockets: WebSocket[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll until `cond` holds or the deadline passes. */
async function until(cond: () => boolean, ms = 2000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(15);
  }
  return cond();
}

interface Client {
  ws: WebSocket;
  msgs: { type: string; pid?: string }[];
  changed: () => number;
}

async function connect(origin?: string): Promise<Client> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    headers: { Host: `127.0.0.1:${port}`, ...(origin ? { Origin: origin } : {}) },
  });
  sockets.push(ws);
  const msgs: Client['msgs'] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  await new Promise<void>((res, rej) => {
    ws.once('open', () => res());
    ws.once('error', rej);
  });
  return { ws, msgs, changed: () => msgs.filter((m) => m.type === 'project-changed').length };
}

async function subscribed(pidToUse = pid): Promise<Client> {
  const c = await connect();
  c.ws.send(JSON.stringify({ type: 'subscribe', pid: pidToUse }));
  await sleep(400); // let the watcher become ready
  return c;
}

async function specFile(): Promise<string> {
  const p = await loadProject(proj);
  return p.specs[0]!.path;
}

async function editSpec(): Promise<void> {
  const file = await specFile();
  const text = await fs.readFile(file, 'utf8');
  await writeIfUnchanged(file, hashText(text), (t) => setMetaField(t, 'urgency', /urgency: high/.test(t) ? 'low' : 'high'));
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sb-rt-'));
  proj = path.join(tmp, 'recipe-box');
  await fs.cp(SAMPLE, proj, { recursive: true });
  registry = new Registry(path.join(tmp, 'projects.json'));
  pid = (await registry.add(proj)).id;
  server = http.createServer((_q, s) => s.end());
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
  runs = fakeRuns();
  rt = await attachRealtime(server, { registry, port: () => port, webDist: null, runs, approved: tempApproved(tmp) });
  await sleep(300); // initial watchers settle
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  await rt.close();
  await new Promise<void>((r) => server.close(() => r()));
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('realtime', () => {
  it('sends hello on connect', async () => {
    const c = await connect();
    expect(await until(() => c.msgs.some((m) => m.type === 'hello'))).toBe(true);
    expect(c.msgs[0]).toEqual({ type: 'hello', app: 'specboard' });
  });

  it('notifies a subscribed client after a write through core', async () => {
    const c = await subscribed();
    const t0 = Date.now();
    await editSpec();
    expect(await until(() => c.changed() >= 1, 1000)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(c.msgs.find((m) => m.type === 'project-changed')).toEqual({ type: 'project-changed', pid });
  });

  it('notifies when the sync proposal is created and when it is deleted', async () => {
    const c = await subscribed();
    const file = path.join(proj, '.specboard', 'sync-proposal.md');
    await fs.writeFile(file, '---\nhead: x\n---\n');
    expect(await until(() => c.changed() >= 1, 1500)).toBe(true);
    await sleep(400);
    const before = c.changed();
    await fs.rm(file);
    expect(await until(() => c.changed() > before, 1500)).toBe(true);
  });

  it('notifies only subscribers of the edited project', async () => {
    const proj2 = path.join(tmp, 'second');
    await fs.cp(SAMPLE, proj2, { recursive: true });
    const pid2 = (await registry.add(proj2)).id;
    await rt.watch(pid2);
    const a = await subscribed(pid);
    const b = await subscribed(pid2);
    await editSpec();
    expect(await until(() => a.changed() >= 1, 1000)).toBe(true);
    await sleep(600);
    expect(b.changed()).toBe(0);
  });

  it('survives a request target of // on upgrade', async () => {
    const sock = net.connect(port, '127.0.0.1');
    sock.on('error', () => undefined);
    await new Promise<void>((r) => sock.once('connect', () => r()));
    sock.write(
      ['GET // HTTP/1.1', `Host: 127.0.0.1:${port}`, 'Upgrade: websocket', 'Connection: Upgrade', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13', '', ''].join('\r\n'),
    );
    await sleep(300);
    sock.destroy();
    const res = await new Promise<number>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/api/health' }, (r) => {
        r.resume();
        resolve(r.statusCode ?? 0);
      }).on('error', reject);
    });
    expect(res).toBe(200);
    const c = await connect();
    expect(await until(() => c.msgs.some((m) => m.type === 'hello'))).toBe(true);
  });

  it('survives a client that resets while being refused', async () => {
    for (let i = 0; i < 5; i++) {
      const sock = net.connect(port, '127.0.0.1');
      sock.on('error', () => undefined);
      await new Promise<void>((r) => sock.once('connect', () => r()));
      sock.write(
        ['GET /ws HTTP/1.1', `Host: 127.0.0.1:${port}`, 'Origin: http://evil.com', 'Upgrade: websocket', 'Connection: Upgrade', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13', '', ''].join('\r\n'),
      );
      sock.resetAndDestroy();
    }
    await sleep(300);
    const c = await connect();
    expect(await until(() => c.msgs.some((m) => m.type === 'hello'))).toBe(true);
  });

  it('fires during a long burst (max wait) instead of only at the end', async () => {
    const c = await subscribed();
    const files = (await loadProject(proj)).specs.slice(0, 4).map((x) => x.path);
    const texts = await Promise.all(files.map((f) => fs.readFile(f, 'utf8')));
    const end = Date.now() + 2500;
    let i = 0;
    while (Date.now() < end) {
      const k = i % files.length;
      await fs.writeFile(files[k]!, texts[k] + `\n<!-- ${i} -->\n`, 'utf8');
      i++;
      await sleep(50);
    }
    expect(c.changed()).toBeGreaterThanOrEqual(2);
  });

  it('keeps watching references when config.md becomes unreadable', async () => {
    const c = await subscribed();
    const cfg = path.join(proj, '.specboard', 'config.md');
    await fs.writeFile(cfg, '---\nname: [oops\nreferences: {{{\n---\n', 'utf8');
    await sleep(700);
    const before = c.changed();
    await fs.appendFile(path.join(proj, 'docs', 'RULES.md'), '\nmore\n', 'utf8');
    expect(await until(() => c.changed() > before)).toBe(true);
  });

  it('collapses 20 quick writes into at most 2 events', async () => {
    const c = await subscribed();
    const file = await specFile();
    const base = await fs.readFile(file, 'utf8');
    for (let i = 0; i < 20; i++) {
      await fs.writeFile(file, base + `\n<!-- ${i} -->\n`, 'utf8');
      await sleep(3);
    }
    expect(await until(() => c.changed() >= 1, 1000)).toBe(true);
    await sleep(600);
    expect(c.changed()).toBeLessThanOrEqual(2);
  });

  it('ignores *.tmp and *.draft.md files', async () => {
    const c = await subscribed();
    await fs.writeFile(path.join(proj, '.specboard', 'x.tmp'), 'x', 'utf8');
    await fs.writeFile(path.join(proj, '.specboard', 'specs', 'spec.draft.md'), '# d', 'utf8');
    await sleep(800);
    expect(c.changed()).toBe(0);
  });

  it('notifies when a linked reference file changes', async () => {
    const c = await subscribed();
    await fs.appendFile(path.join(proj, 'docs', 'RULES.md'), '\nmore\n', 'utf8');
    expect(await until(() => c.changed() >= 1)).toBe(true);
  });

  it('picks up references added later via config.md', async () => {
    const c = await subscribed();
    await fs.writeFile(path.join(proj, 'docs', 'NEW.md'), '# new\n', 'utf8');
    const cfg = path.join(proj, '.specboard', 'config.md');
    const text = await fs.readFile(cfg, 'utf8');
    await fs.writeFile(cfg, text.replace('references:\n', 'references:\n  - docs/NEW.md\n'), 'utf8');
    expect(await until(() => c.changed() >= 1)).toBe(true);
    await sleep(600);
    const before = c.changed();
    await fs.appendFile(path.join(proj, 'docs', 'NEW.md'), 'x\n', 'utf8');
    expect(await until(() => c.changed() > before)).toBe(true);
  });

  it('never watches references outside the project', async () => {
    const outside = path.join(tmp, 'outside.md');
    await fs.writeFile(outside, '# o\n', 'utf8');
    const cfg = path.join(proj, '.specboard', 'config.md');
    const text = await fs.readFile(cfg, 'utf8');
    await fs.writeFile(cfg, text.replace('references:\n', 'references:\n  - ../outside.md\n'), 'utf8');
    const c = await subscribed();
    await sleep(600);
    const before = c.changed();
    await fs.appendFile(outside, 'x\n', 'utf8');
    await sleep(700);
    expect(c.changed()).toBe(before);
  });

  it('watches a project registered after startup via watch(pid)', async () => {
    const proj2 = path.join(tmp, 'second');
    await fs.cp(SAMPLE, proj2, { recursive: true });
    const pid2 = (await registry.add(proj2)).id;
    await rt.watch(pid2);
    const c = await subscribed(pid2);
    await fs.appendFile(path.join(proj2, 'docs', 'RULES.md'), '\nmore\n', 'utf8');
    expect(await until(() => c.changed() >= 1)).toBe(true);
  });

  it('rejects an upgrade with a foreign Origin (403)', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Host: `127.0.0.1:${port}`, Origin: 'http://evil.com' } });
    sockets.push(ws);
    const status = await new Promise<number>((res) => {
      ws.once('unexpected-response', (_q, r) => res(r.statusCode ?? 0));
      ws.once('open', () => res(101));
      ws.once('error', () => res(-1));
    });
    expect(status).toBe(403);
  });

  it('rejects an upgrade with a bad Host (403)', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Host: 'evil.com' } });
    sockets.push(ws);
    const status = await new Promise<number>((res) => {
      ws.once('unexpected-response', (_q, r) => res(r.statusCode ?? 0));
      ws.once('open', () => res(101));
      ws.once('error', () => res(-1));
    });
    expect(status).toBe(403);
  });
});

describe('typed messages and run hooks', () => {
  it('send() reaches only subscribers of that project, and survives a closed socket', async () => {
    const a = await subscribed();
    const gone = await subscribed();
    const other = await subscribed('someone-else');
    gone.ws.terminate();
    expect(() => rt.send(pid, { type: 'run-line', runId: 'r1', line: { k: 'text', text: 'hi' } })).not.toThrow();
    expect(await until(() => a.msgs.some((m) => m.type === 'run-line'))).toBe(true);
    await sleep(100);
    expect(other.msgs.some((m) => m.type === 'run-line')).toBe(false);
  });

  it('tells the run manager about a change, and a failure there is logged and does not stop the watcher', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    runs.projectChanged.mockRejectedValueOnce(new Error('tick failed'));
    const c = await subscribed();
    await editSpec();
    expect(await until(() => runs.projectChanged.mock.calls.length >= 1, 1500)).toBe(true);
    expect(runs.projectChanged.mock.calls[0]![0]).toMatchObject({ id: pid });
    expect(await until(() => log.mock.calls.length >= 1, 500)).toBe(true);
    await sleep(300);
    const before = c.changed();
    await editSpec();
    expect(await until(() => c.changed() > before)).toBe(true);
    log.mockRestore();
  });
});
