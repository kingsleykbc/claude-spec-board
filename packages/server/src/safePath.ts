import fs from 'node:fs';
import path from 'node:path';

export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathError';
  }
}

function inside(root: string, file: string): boolean {
  const rel = path.relative(root, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Resolve a project-relative `.md` path to an absolute one, or throw PathError.
 * Rejects absolute, drive-letter, UNC and NUL paths, anything escaping `root`
 * (including via symlinks), and non-Markdown files. Backslashes count as separators everywhere.
 */
export function safeProjectPath(root: string, rel: string): string {
  if (typeof rel !== 'string' || rel === '') throw new PathError('Invalid path');
  if (rel.includes('\0')) throw new PathError('Invalid path');
  if (/^[\\/]/.test(rel) || /^[A-Za-z]:/.test(rel)) throw new PathError('Path must be relative to the project');
  const norm = rel.replace(/\\/g, '/');
  if (!norm.toLowerCase().endsWith('.md')) throw new PathError('Only .md files are allowed');
  const absRoot = path.resolve(root);
  const abs = path.resolve(absRoot, ...norm.split('/'));
  if (!inside(absRoot, abs)) throw new PathError('Path escapes the project');
  // Symlink check: the deepest existing ancestor (or the file itself) must stay inside the real root.
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(absRoot);
  } catch {
    return abs;
  }
  let probe = abs;
  for (;;) {
    try {
      const real = fs.realpathSync(probe);
      if (real !== realRoot && !inside(realRoot, real)) throw new PathError('Path escapes the project');
      break;
    } catch (e) {
      if (e instanceof PathError) throw e;
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
  }
  return abs;
}
