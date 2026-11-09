import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createAdaptorServer } from '@hono/node-server';
import getPort from 'get-port';
import open from 'open';
import { attachRealtime, createApp, type Realtime } from './app.js';
import { initHint } from './prePublish.js';
import { Registry } from './registry.js';
import { RunManager } from './claude/runs.js';
import { claudeStatus, type ClaudeStatus } from './claude/status.js';
import { approvedStore, specboardHome } from './setup.js';

export interface StartOptions {
  path: string;
  port: number;
  open: boolean;
  /** Browser launcher; defaults to the `open` package. Tests inject one. */
  opener?: (url: string) => Promise<unknown>;
  /** Replaces how `claude` is launched and checked. Tests inject a fake CLI; the real one is never started by tests. */
  claude?: { command?: (args: string[]) => { bin: string; args: string[] }; status?: () => Promise<ClaudeStatus> };
}

export interface Started {
  url: string;
  close(): Promise<void>;
}

const HOST = '127.0.0.1';

function registryFile(): string {
  return path.join(specboardHome(), 'projects.json');
}

/** True when a Spec Board server answers on `port` within 500 ms. */
async function isSpecBoard(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${HOST}:${port}/api/health`, { signal: AbortSignal.timeout(500) });
    if (!res.ok) return false;
    const body = (await res.json()) as { app?: unknown };
    return body.app === 'specboard';
  } catch {
    return false;
  }
}

function webDistDir(): string | null {
  const dir = path.resolve(import.meta.dirname, '../../web/dist');
  return fs.existsSync(dir) ? dir : null;
}

async function tryOpen(opts: StartOptions, base: string, id: string): Promise<void> {
  if (!opts.open) return;
  try {
    await (opts.opener ?? open)(`${base}/?project=${id}`);
  } catch {
    console.error(`Could not open a browser. Open ${base} yourself.`);
  }
}

export async function start(opts: StartOptions): Promise<Started> {
  const root = path.resolve(opts.path);
  if (!fs.existsSync(path.join(root, '.specboard', 'config.md'))) {
    throw new Error(`No .specboard folder in ${root}. ${initHint(root)}`);
  }
  const registry = new Registry(registryFile());

  if (opts.port !== 0 && (await isSpecBoard(opts.port))) {
    const entry = await registry.add(root);
    const url = `http://${HOST}:${opts.port}`;
    await tryOpen(opts, url, entry.id);
    return { url, close: async () => {} };
  }

  const port = await getPort({ port: opts.port === 0 ? undefined : opts.port, host: HOST });
  let bound = port;
  const approved = approvedStore();
  const status = opts.claude?.status ?? claudeStatus;
  let rt: Realtime | undefined;
  const runs = new RunManager({ approved, emit: (id, e) => rt?.send(id, e), command: opts.claude?.command, status });
  const deps = { registry, port: () => bound, webDist: webDistDir(), runs, approved, status };
  const server = createAdaptorServer({ fetch: createApp(deps).fetch }) as Server;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });
  bound = (server.address() as AddressInfo).port;
  const close = async () => {
    try {
      await runs.close(); // while the sockets are still open, so clients hear the runs end
    } finally {
      try {
        await rt?.close();
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  };

  try {
    const entry = await registry.add(root);
    rt = await attachRealtime(server, deps);
    await rt.watch(entry.id);
    const url = `http://${HOST}:${bound}`;
    await tryOpen(opts, url, entry.id);
    return { url, close };
  } catch (e) {
    await close().catch(() => {});
    throw e;
  }
}
