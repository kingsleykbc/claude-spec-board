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

const unquote = (entry: string): string => entry.trim().replace(/^"(.*)"$/, '$1');

/**
 * The keys that hold variable `name`. Windows ignores case, so it may be `Path`, and a plain object can hold several:
 * Node starts a child with the first in sorted order, so that one comes first here.
 */
export function envKeys(env: NodeJS.ProcessEnv, name: string): string[] {
  return Object.keys(env).filter((k) => (WIN ? k.toUpperCase() === name : k === name)).sort();
}

const envValue = (env: NodeJS.ProcessEnv, name: string): string | undefined => {
  const key = envKeys(env, name)[0];
  return key === undefined ? undefined : env[key];
};

/** The absolute PATH entries, in order, as written (`entry`) and unquoted (`dir`), with the `exclude` folder holding each, if any. */
function absoluteEntries(value: string | undefined, exclude: string[]): { entry: string; dir: string; root: string | undefined }[] {
  const excluded = exclude.map((root) => ({ root, real: realPathLoose(root) }));
  return (value ?? '').split(path.delimiter).flatMap((entry) => {
    const dir = unquote(entry);
    if (!isFullPath(dir)) return [];
    const real = realPathLoose(dir);
    return [{ entry, dir, root: excluded.find((x) => isWithin(x.real, real))?.root }];
  });
}

/** The PATH entries that may be searched, as written and in order: absolute, and outside every `exclude` folder. */
const searchableEntries = (value: string | undefined, exclude: string[]): string[] =>
  absoluteEntries(value, exclude).filter((e) => e.root === undefined).map((e) => e.entry);

/** The PATH entries in `env` left out for being inside an `exclude` folder, with that folder. */
export function droppedEntries(env: NodeJS.ProcessEnv, exclude: string[]): { dir: string; root: string }[] {
  return absoluteEntries(envValue(env, 'PATH'), exclude).flatMap(({ dir, root }) => (root === undefined ? [] : [{ dir, root }]));
}

/** PATH without what a project could supply, for a child whose own bare commands are looked up through it. */
export const searchablePath = (value: string | undefined, exclude: string[]): string =>
  searchableEntries(value, exclude).join(path.delimiter);

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
  const exts = WIN ? (lookup.PATHEXT || DEFAULT_PATHEXT).split(';').filter((e) => STARTABLE.test(e)) : [''];
  for (const entry of searchableEntries(lookup.PATH, lookup.exclude ?? [])) {
    const dir = unquote(entry);
    for (const ext of exts) {
      const file = path.join(dir, name + ext.toLowerCase());
      if (isCommandFile(file)) return file;
    }
  }
  return null;
}

/** `resolveCommand` with PATH and PATHEXT from `env`, under whichever spelling of the key it has. */
export const resolveFromEnv = (name: string, env: NodeJS.ProcessEnv, exclude: string[]): string | null =>
  resolveCommand(name, { PATH: envValue(env, 'PATH'), PATHEXT: envValue(env, 'PATHEXT'), exclude });

/** Where `name` is if only a dropped entry holds it, or null. Only looks: nothing found here may be started. */
export function resolveOnlyInDropped(name: string, env: NodeJS.ProcessEnv, exclude: string[]): string | null {
  if (resolveFromEnv(name, env, exclude) !== null) return null;
  const PATH = droppedEntries(env, exclude).map((d) => d.dir).join(path.delimiter);
  return resolveCommand(name, { PATH, PATHEXT: envValue(env, 'PATHEXT') });
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
