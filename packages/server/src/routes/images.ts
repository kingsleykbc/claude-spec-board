import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { HttpError, onError } from '../http.js';
import type { Registry } from '../registry.js';
import { PathError, safeProjectFile } from '../safePath.js';

/** Only these are ever served, whatever the path says. */
export const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

/** Shows an image that a spec or reference links to, from anywhere inside its project. */
export function imageRoutes(registry: Registry): Hono {
  const app = new Hono();

  app.get('/api/projects/:pid/image', async (c) => {
    const entry = await registry.get(c.req.param('pid'));
    if (!entry) throw new HttpError(404, 'Unknown project');
    const rel = c.req.query('path');
    if (!rel) throw new HttpError(400, 'Missing or invalid "path"');
    const type = IMAGE_TYPES[path.extname(rel.split(String.fromCharCode(92)).join('/')).toLowerCase()];
    if (!type) throw new HttpError(400, 'Only image files can be shown');
    let file: string;
    try {
      file = safeProjectFile(entry.root, rel);
    } catch (e) {
      if (e instanceof PathError) throw new HttpError(400, e.message);
      throw e;
    }
    const data = await fs.readFile(file).catch(() => null);
    if (!data) throw new HttpError(404, 'Image not found');
    const headers: Record<string, string> = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };
    // An svg opened on its own page could run script; sandbox keeps it a picture.
    if (type === 'image/svg+xml') headers['Content-Security-Policy'] = 'sandbox';
    return new Response(new Uint8Array(data), { headers });
  });

  app.onError(onError);
  return app;
}
