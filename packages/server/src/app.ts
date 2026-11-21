import fs from 'node:fs/promises';
import path from 'node:path';
import type { Server } from 'node:http';
import { Hono } from 'hono';
import { compareIds, loadProject, nextId } from '@specboard/core';
import type { ProjectEntry, Registry } from './registry.js';
import { Hub } from './hub.js';
import { PathError, safeProjectPath } from './safePath.js';
import { watchProject } from './watch.js';
import { guard } from './security.js';
import { isBundled } from './paths.js';
import { specRoutes } from './routes/specs.js';
import { referenceRoutes } from './routes/references.js';
import { runRoutes } from './routes/runs.js';
import { syncRoutes } from './routes/sync.js';
import { fileRoutes, type FileOpener } from './routes/files.js';
import { imageRoutes } from './routes/images.js';
import { claudeStatus, type ClaudeStatus } from './claude/status.js';
import type { RunManager } from './claude/runs.js';
import type { ApprovedPermissions } from './setup.js';

export interface AppDeps {
  registry: Registry;
  port: () => number;
  webDist: string | null;
  runs: RunManager;
  approved: ApprovedPermissions;
  /** Claude Code install and login check; defaults to the cached real one. */
  status?: () => Promise<ClaudeStatus>;
  /** What a click on a file path does; defaults to VS Code. */
  openFile?: FileOpener;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

async function readFileIn(root: string, urlPath: string): Promise<{ data: Buffer; file: string } | null> {
  let rel: string;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const file = path.resolve(root, rel.replace(/^[/\\]+/, ''));
  const within = path.relative(root, file);
  if (within === '' || within.startsWith('..') || path.isAbsolute(within)) return null;
  try {
    return { data: await fs.readFile(file), file };
  } catch {
    return null;
  }
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.use('*', guard(deps.port));

  app.get('/api/health', (c) => c.json({ ok: true, app: 'specboard', plugin: isBundled() }));

  app.get('/api/projects', async (c) => {
    const entries = await deps.registry.list();
    const all = await Promise.all(
      entries.map(async (entry) => {
        const p = await loadProject(entry.root);
        // Archived specs count as done.
        const done = p.archived.length + p.specs.filter((s) => s.status === 'done').length;
        const available = await fs.access(path.join(entry.root, '.specboard', 'config.md')).then(() => true, () => false);
        return { ...entry, available, progress: { done, total: p.specs.length + p.archived.length } };
      }),
    );
    return c.json(all.filter((p) => p.available));
  });

  app.get('/api/projects/:pid', async (c) => {
    const entry = await deps.registry.get(c.req.param('pid'));
    if (!entry) return c.json({ error: 'Unknown project' }, 404);
    const project = await loadProject(entry.root);
    project.specs.sort((a, b) => compareIds(a.id, b.id));
    project.archived.sort((a, b) => compareIds(a.id, b.id));
    return c.json({ entry, project, nextId: await nextId(entry.root) });
  });

  app.route('/', specRoutes(deps.registry));
  app.route('/', referenceRoutes(deps.registry));
  app.route('/', fileRoutes(deps.registry, deps.openFile));
  app.route('/', imageRoutes(deps.registry));
  app.route('/', syncRoutes(deps.registry));
  app.route('/', runRoutes({ registry: deps.registry, runs: deps.runs, approved: deps.approved, status: deps.status ?? claudeStatus }));

  if (deps.webDist !== null) {
    const root = path.resolve(deps.webDist);
    app.get('/*', async (c) => {
      if (c.req.path.startsWith('/api/') || c.req.path === '/ws') return c.json({ error: 'Not found' }, 404);
      const hit = (await readFileIn(root, c.req.path)) ?? (await readFileIn(root, '/index.html'));
      if (!hit) return c.json({ error: 'Not found' }, 404);
      const type = TYPES[path.extname(hit.file).toLowerCase()] ?? 'application/octet-stream';
      return new Response(new Uint8Array(hit.data), { headers: { 'content-type': type } });
    });
  }

  return app;
}

export interface Realtime {
  /** Start watching a project (no-op if already watched or unknown). */
  watch(pid: string): Promise<void>;
  /** Send a typed message to the clients subscribed to `pid`. */
  send(pid: string, msg: object): void;
  close(): Promise<void>;
}

/** Absolute paths of a project's safe, existing reference files. Anything unsafe or missing is skipped. */
async function referenceFiles(entry: ProjectEntry): Promise<string[]> {
  const { config } = await loadProject(entry.root);
  if (!config || config.problems.length > 0) throw new Error('config.md unreadable'); // caller keeps its current watch set
  const out: string[] = [];
  for (const ref of config.references) {
    try {
      const abs = safeProjectPath(entry.root, ref);
      if ((await fs.stat(abs)).isFile()) out.push(abs);
    } catch (e) {
      if (!(e instanceof PathError) && (e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  return out;
}

/** WebSocket `/ws` on `server` plus file watching for every registered project. */
export async function attachRealtime(server: Server, deps: AppDeps): Promise<Realtime> {
  const stops = new Map<string, Promise<(() => Promise<void>) | null>>();
  let closed = false;
  const hub = new Hub(server, deps.port, (pid) => void watch(pid));

  async function watch(pid: string): Promise<void> {
    if (closed || stops.has(pid)) return;
    const started = (async () => {
      const entry = await deps.registry.get(pid);
      if (!entry || closed) return null;
      return watchProject(entry, () => referenceFiles(entry), (id) => {
        hub.send(id, { type: 'project-changed', pid: id });
        deps.runs.projectChanged(entry).catch((e: unknown) => console.error(`Run progress update failed: ${e instanceof Error ? e.message : String(e)}`));
      });
    })();
    stops.set(pid, started);
    try {
      if ((await started) === null) stops.delete(pid);
    } catch {
      stops.delete(pid);
    }
  }

  await Promise.all((await deps.registry.list()).map((e) => watch(e.id)));

  return {
    watch,
    send: (pid, msg) => hub.send(pid, msg),
    async close() {
      closed = true;
      await hub.close();
      const all = [...stops.values()];
      stops.clear();
      for (const p of all) {
        const stop = await p.catch(() => null);
        if (stop) await stop();
      }
    },
  };
}
