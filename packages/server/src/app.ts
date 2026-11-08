import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { compareIds, loadProject, nextId } from '@specboard/core';
import type { Registry } from './registry.js';
import { guard } from './security.js';

/** Placeholder for the Claude Code bridge; filled in by the M3 work. Unused until then. */
export interface ClaudeBridge {}

export interface AppDeps {
  registry: Registry;
  port: () => number;
  webDist: string | null;
  claude?: ClaudeBridge;
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

  app.get('/api/health', (c) => c.json({ ok: true, app: 'specboard' }));

  app.get('/api/projects', async (c) => {
    const entries = await deps.registry.list();
    const out = await Promise.all(
      entries.map(async (entry) => {
        const p = await loadProject(entry.root);
        // Archived specs count as done.
        const done = p.archived.length + p.specs.filter((s) => s.status === 'done').length;
        return { ...entry, progress: { done, total: p.specs.length + p.archived.length } };
      }),
    );
    return c.json(out);
  });

  app.get('/api/projects/:pid', async (c) => {
    const entry = await deps.registry.get(c.req.param('pid'));
    if (!entry) return c.json({ error: 'Unknown project' }, 404);
    const project = await loadProject(entry.root);
    project.specs.sort((a, b) => compareIds(a.id, b.id));
    project.archived.sort((a, b) => compareIds(a.id, b.id));
    return c.json({ entry, project, nextId: await nextId(entry.root) });
  });

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
