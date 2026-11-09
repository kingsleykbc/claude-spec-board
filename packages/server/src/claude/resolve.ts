import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import treeKill from 'tree-kill';
import { isWithin, realPathLoose } from '../safePath.js';

const WIN = process.platform === 'win32';
const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';
/** What can actually start on Windows without a file association deciding. */
const STARTABLE = /^\.(?:com|exe|bat|cmd)$/i;

export interface CommandLookup {
  PATH?: string | undefined;
  PATHEXT?: string | undefined;
  /** Folders never searched, nor anything under them: a project's files are not trusted. */
  exclude?: string[];
}

/** A full path from a fixed root. On Windows `\x` and `C:x` depend on the current drive or folder, so they don't count. */
const isFullPath = (p: string): boolean => (WIN ? /^(?:[A-Za-z]:[\\/]|\\\\)/.test(p) : p.startsWith('/'));

function isCommandFile(file: string): boolean {
  try {
    if (!fs.statSync(file).isFile()) return false;
    if (!WIN) fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds a command ourselves, as an absolute path. A bare name handed to Windows or `which` is looked up in the current
 * folder first, which for a run is the project: a `claude.cmd` in a repo's root would run with the person's rights.
 * Only absolute PATH entries outside `exclude` count, tried per entry in PATHEXT order. null when there is none.
 */
export function resolveCommand(name: string, lookup: CommandLookup): string | null {
  const excluded = (lookup.exclude ?? []).map(realPathLoose);
  const exts = WIN ? (lookup.PATHEXT || DEFAULT_PATHEXT).split(';').filter((e) => STARTABLE.test(e)) : [''];
  for (const raw of (lookup.PATH ?? '').split(path.delimiter)) {
    const dir = raw.trim().replace(/^"(.*)"$/, '$1');
    if (!isFullPath(dir)) continue;
    const real = realPathLoose(dir);
    if (excluded.some((x) => isWithin(x, real))) continue;
    for (const ext of exts) {
      const file = path.join(dir, name + ext.toLowerCase());
      if (isCommandFile(file)) return file;
    }
  }
  return null;
}

/** The system's own taskkill. tree-kill runs a bare `taskkill` through a shell, found in the current folder first. */
export function taskkillPath(env: NodeJS.ProcessEnv = process.env): string {
  const root = env.SystemRoot && isFullPath(env.SystemRoot) ? env.SystemRoot : 'C:\\Windows';
  return path.win32.join(root, 'System32', 'taskkill.exe');
}

/** Kills a process and everything it started. It may have just gone, so failures are ignored. */
export function killTree(pid: number, signal: 'SIGTERM' | 'SIGKILL'): void {
  if (!WIN) {
    treeKill(pid, signal, () => undefined);
    return;
  }
  // /T /F: there is no graceful stop on Windows, whatever the signal.
  spawn(taskkillPath(), ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on('error', () => undefined);
}
