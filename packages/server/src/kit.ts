import fs from 'node:fs/promises';
import path from 'node:path';

import { pluginDir } from './paths.js';

const kitDir = (): string => path.join(pluginDir(), 'skills');

/** The kit as a Claude Code plugin named `specboard`, for `--plugin-dir`. */
export function kitPluginDir(): string {
  return pluginDir();
}

export type InstallResult = { name: string; action: 'created' | 'unchanged' | 'updated' | 'skipped-modified' };

/** Line endings must not decide whether a file counts as edited (git on Windows may check out CRLF). */
function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** The skills shipped with Spec Board, in folder-name order. Text always uses LF. */
export async function kitSkills(): Promise<{ name: string; text: string }[]> {
  const entries = await fs.readdir(kitDir(), { withFileTypes: true });
  const names = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      text: normalize(await fs.readFile(path.join(kitDir(), name, 'SKILL.md'), 'utf8')),
    })),
  );
}

/**
 * Refuse to write through a link: every existing component of `parts` (e.g. `.claude/skills/<name>/SKILL.md`) must be a real
 * file or folder (symlinks and Windows junctions both show up as links in lstat) inside the real project root.
 */
export async function assertNoLinks(realRoot: string, parts: string[], what = 'install skills'): Promise<void> {
  let current = realRoot;
  for (const part of parts) {
    current = path.join(current, part);
    let st;
    try {
      st = await fs.lstat(current);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
    if (st.isSymbolicLink() || (await fs.realpath(current)) !== current) {
      throw new Error(`Refusing to ${what}: ${current} is a link, not a real file or folder`);
    }
  }
}

/** Skills that only make sense inside the plugin (setup runs the plugin's own `specboard`), so `init` never copies them. */
export const PLUGIN_ONLY_SKILLS = new Set(['setup']);

/**
 * Copy the kit, less the plugin-only skills, into `<root>/.claude/skills/<name>/SKILL.md`. A file equal to the current
 * kit text is `unchanged`, a missing one `created`, and a different one `skipped-modified` unless `force`, then `updated`.
 */
export async function installSkills(root: string, opts: { force?: boolean } = {}): Promise<InstallResult[]> {
  const realRoot = await fs.realpath(root);
  const kit = (await kitSkills()).filter((s) => !PLUGIN_ONLY_SKILLS.has(s.name));
  for (const { name } of kit) await assertNoLinks(realRoot, ['.claude', 'skills', name, 'SKILL.md']); // check everything before writing anything
  const results: InstallResult[] = [];
  for (const { name, text } of kit) {
    const file = path.join(realRoot, '.claude', 'skills', name, 'SKILL.md');
    let existing: string | null = null;
    try {
      existing = await fs.readFile(file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    let action: InstallResult['action'];
    if (existing === null) action = 'created';
    else if (normalize(existing) === text) action = 'unchanged';
    else action = opts.force ? 'updated' : 'skipped-modified';
    if (action === 'created' || action === 'updated') {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, text);
    }
    results.push({ name, action });
  }
  return results;
}
