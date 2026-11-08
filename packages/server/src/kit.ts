import fs from 'node:fs/promises';
import path from 'node:path';

const KIT_DIR = path.resolve(import.meta.dirname, '..', 'kit', 'skills');

export type InstallResult = { name: string; action: 'created' | 'unchanged' | 'updated' | 'skipped-modified' };

/** Line endings must not decide whether a file counts as edited (git on Windows may check out CRLF). */
function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** The skills shipped with Spec Board, in folder-name order. Text always uses LF. */
export async function kitSkills(): Promise<{ name: string; text: string }[]> {
  const entries = await fs.readdir(KIT_DIR, { withFileTypes: true });
  const names = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      text: normalize(await fs.readFile(path.join(KIT_DIR, name, 'SKILL.md'), 'utf8')),
    })),
  );
}

/**
 * Copy the kit into `<root>/.claude/skills/<name>/SKILL.md`. A file equal to the current kit text is
 * `unchanged`, a missing one `created`, and a different one `skipped-modified` unless `force`, then `updated`.
 */
export async function installSkills(root: string, opts: { force?: boolean } = {}): Promise<InstallResult[]> {
  const results: InstallResult[] = [];
  for (const { name, text } of await kitSkills()) {
    const file = path.join(root, '.claude', 'skills', name, 'SKILL.md');
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
