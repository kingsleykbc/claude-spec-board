import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createAdaptorServer } from '@hono/node-server';
import getPort from 'get-port';
import open from 'open';
import { attachRealtime, createApp, type Realtime } from './app.js';
import { Registry } from './registry.js';

export interface StartOptions {
  path: string;
  port: number;
  open: boolean;
  /** Browser launcher; defaults to the `open` package. Tests inject one. */
  opener?: (url: string) => Promise<unknown>;
}

export interface Started {
  url: string;
  close(): Promise<void>;
}

const HOST = '127.0.0.1';

/** Directory holding `projects.json`: `$SPECBOARD_HOME`, else `~/.specboard`. */
function registryFile(): string {
  const dir = process.env.SPECBOARD_HOME ?? path.join(os.homedir(), '.specboard');
  return path.join(dir, 'projects.json');
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
    throw new Error(
      `No .specboard folder in ${root}. Run the Claude Code /create-spec command or "specboard init" (coming in M3).`,
    );
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
  const deps = { registry, port: () => bound, webDist: webDistDir() };
  const server = createAdaptorServer({ fetch: createApp(deps).fetch }) as Server;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });
  bound = (server.address() as AddressInfo).port;
  let rt: Realtime | undefined;
  const close = async () => {
    try {
      await rt?.close();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
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
