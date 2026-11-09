import fs from 'node:fs/promises';
import os from 'node:os';
import { Hono } from 'hono';
import spawn from 'cross-spawn';
import { childEnv } from '../claude/status.js';
import { resolveFromEnv } from '../claude/resolve.js';
import { HttpError, onError, readJson, requireString } from '../http.js';
import type { Registry } from '../registry.js';
import { PathError, safeProjectFile } from '../safePath.js';

/** Opens `file` for the person; false when there's nothing to open it with. Never runs from a folder in `exclude`. */
export type FileOpener = (file: string, exclude: string[]) => Promise<boolean>;

/**
 * VS Code only, found the way `claude` is: by absolute path, outside every registered project. There's deliberately no
 * fallback to the system's default app: a repo's log can name any file, and "opening" a `.bat` or `.exe` runs it.
 */
export const openInVsCode: FileOpener = (file, exclude) => {
  const bin = resolveFromEnv('code', process.env, exclude);
  if (bin === null) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const child = spawn(bin, [file], { cwd: os.tmpdir(), env: childEnv(exclude), stdio: 'ignore', windowsHide: true });
      child.on('error', () => resolve(false));
      child.on('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
};

/** `opened: false` hands back the full path, so the board can copy it instead. */
export function fileRoutes(registry: Registry, open: FileOpener = openInVsCode): Hono {
  const app = new Hono();

  app.post('/api/projects/:pid/open-file', async (c) => {
    const b = await readJson(c);
    const rel = requireString(b, 'path', false);
    const entry = await registry.get(c.req.param('pid'));
    if (!entry) throw new HttpError(404, 'Unknown project');
    let file: string;
    try {
      file = safeProjectFile(entry.root, rel);
    } catch (e) {
      if (e instanceof PathError) throw new HttpError(400, e.message);
      throw e;
    }
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) return c.json({ opened: false, path: file, reason: 'missing' });
    const opened = await open(file, await registry.roots());
    return c.json(opened ? { opened: true, path: file } : { opened: false, path: file, reason: 'no-editor' });
  });

  app.onError(onError);
  return app;
}
