import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createAdaptorServer } from '@hono/node-server';
import getPort from 'get-port';
import open from 'open';
import { attachRealtime, createApp, type Realtime } from './app.js';
import { webDistDir } from './paths.js';
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
  /** Called after the board has closed itself on request (`POST /api/shutdown`); defaults to `process.exit`. */
  exit?: (code: number) => void;
  /** What `/api/health` reports as the version; defaults to the plugin version. Tests use it to play an older board. */
  version?: string;
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

/** What a Spec Board answering on `port` says about itself within 500 ms (version is absent before 0.4.1); null when it is not one. */
export async function boardInfo(port: number): Promise<{ version?: string } | null> {
  try {
    const res = await fetch(`http://${HOST}:${port}/api/health`, { signal: AbortSignal.timeout(500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { app?: unknown; version?: unknown };
    if (body.app !== 'specboard') return null;
    return typeof body.version === 'string' ? { version: body.version } : {};
  } catch {
    return null;
  }
}

/** True when a Spec Board server answers on `port` within 500 ms. */
export async function isSpecBoard(port: number): Promise<boolean> {
  return (await boardInfo(port)) !== null;
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
  const runs = new RunManager({ approved, emit: (id, e) => rt?.send(id, e), command: opts.claude?.command, status, roots: () => registry.roots() });
  let closeBoard: () => Promise<void> = async () => {};
  const onShutdown = () => {
    closeBoard().then(
      () => (opts.exit ?? process.exit)(0),
      () => (opts.exit ?? process.exit)(1),
    );
  };
  const deps = { registry, port: () => bound, webDist: webDistDir(), runs, approved, status, onShutdown, version: opts.version };
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

  closeBoard = close;
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
