import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { loadProject, slugify } from '@specboard/core';
import { HttpError, onError, readJson, requireString } from '../http.js';
import type { Registry } from '../registry.js';
import { PathError, safeProjectFile } from '../safePath.js';
import { IMAGE_EXTS } from './images.js';

const MAX_BYTES = 10 * 1024 * 1024;
/** Base64 is 4/3 the size of the bytes; the slack covers the JSON around it. */
const MAX_BODY = Math.ceil((MAX_BYTES * 4) / 3) + 4096;
const TOO_BIG = 'Image is larger than 10 MB';

/** The exact byte count of a base64 string, or null when it is not valid base64. */
function decodedLength(b64: string): number | null {
  if (b64 === '' || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) return null;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

/** A safe file name: lower-case slug of the stem plus the lower-case extension. Throws 400 for a type we don't take. */
function cleanName(name: string): { stem: string; ext: string } {
  const base = name.split(String.fromCharCode(92)).join('/').split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  const ext = dot === -1 ? '' : base.slice(dot).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) throw new HttpError(400, `Only these image types can be added: ${IMAGE_EXTS.join(' ')}`);
  const raw = base.slice(0, dot);
  const slug = slugify(raw);
  // slugify answers "spec" when nothing usable is left; that is no name for an image.
  return { stem: raw === '' || (slug === 'spec' && !/spec/i.test(raw)) ? 'image' : slug, ext };
}

/** Adds an image to a spec's images folder. */
export function uploadRoutes(registry: Registry): Hono {
  const app = new Hono();

  app.post(
    '/api/projects/:pid/specs/:id/images',
    bodyLimit({
      maxSize: MAX_BODY,
      onError: () => {
        throw new HttpError(413, TOO_BIG);
      },
    }),
    async (c) => {
      const entry = await registry.get(c.req.param('pid') ?? '');
      if (!entry) throw new HttpError(404, 'Unknown project');
      const b = await readJson(c);
      const name = requireString(b, 'name', false);
      const data = requireString(b, 'data', false);
      const { stem, ext } = cleanName(name);
      const size = decodedLength(data);
      if (size === null) throw new HttpError(400, 'Image data is not valid base64');
      if (size > MAX_BYTES) throw new HttpError(413, TOO_BIG);

      const id = c.req.param('id') ?? '';
      const project = await loadProject(entry.root);
      const spec = project.specs.find((s) => s.id === id);
      if (!spec) {
        if (project.archived.some((s) => s.id === id)) throw new HttpError(409, `Spec ${id} is archived`);
        throw new HttpError(404, `Spec ${id} not found`);
      }

      const dir = path.join(path.dirname(spec.path), 'images');
      const relDir = path.relative(entry.root, dir).split(path.sep).join('/');
      const bytes = Buffer.from(data, 'base64');
      try {
        safeProjectFile(entry.root, relDir);
        await fs.mkdir(dir, { recursive: true });
        for (let n = 1; ; n++) {
          const file = `${n === 1 ? stem : `${stem}-${n}`}${ext}`;
          safeProjectFile(entry.root, `${relDir}/${file}`);
          try {
            await fs.writeFile(path.join(dir, file), bytes, { flag: 'wx' });
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'EEXIST') continue;
            throw e;
          }
          return c.json({ path: `images/${file}` }, 201);
        }
      } catch (e) {
        if (e instanceof PathError) throw new HttpError(400, e.message);
        throw e;
      }
    },
  );

  app.onError(onError);
  return app;
}
