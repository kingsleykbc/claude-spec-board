import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { hashText, loadProject, writeIfUnchanged } from '@specboard/core';

export interface ProjectEntry {
  id: string;
  name: string;
  root: string;
}

/** id = first 8 hex chars of sha1 of the lowercased, resolved root. */
export function projectId(root: string): string {
  return createHash('sha1').update(path.resolve(root).toLowerCase()).digest('hex').slice(0, 8);
}

/** The registered set can't be known, so nothing may be started: any folder could be a project. */
export class RegistryUnreadableError extends Error {
  constructor(file: string) {
    super(`Cannot read the project list (${file}), so Spec Board won't start Claude Code. Fix or remove that file.`);
    this.name = 'RegistryUnreadableError';
  }
}

function isEntry(v: unknown): v is ProjectEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.name === 'string' && typeof e.root === 'string';
}

/** The list of known projects, kept in one JSON file (normally `~/.specboard/projects.json`). */
export class Registry {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async read(): Promise<{ entries: ProjectEntry[]; raw: unknown[]; corrupt: boolean; text: string | null }> {
    let text: string;
    try {
      text = await fs.readFile(this.file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { entries: [], raw: [], corrupt: false, text: null };
      throw e;
    }
    try {
      const data: unknown = JSON.parse(text);
      if (Array.isArray(data)) return { entries: data.filter(isEntry), raw: data, corrupt: false, text };
    } catch {
      // fall through: unparsable
    }
    return { entries: [], raw: [], corrupt: true, text };
  }

  async list(): Promise<ProjectEntry[]> {
    return (await this.read()).entries;
  }

  /** Every registered root, for keeping their programs from being run. Throws rather than answer "none" from a file it can't read. */
  async roots(): Promise<string[]> {
    const { entries, corrupt } = await this.read().catch(() => {
      throw new RegistryUnreadableError(this.file);
    });
    if (corrupt) throw new RegistryUnreadableError(this.file);
    return entries.map((e) => e.root);
  }

  async get(id: string): Promise<ProjectEntry | null> {
    return (await this.list()).find((e) => e.id === id) ?? null;
  }

  async add(root: string): Promise<ProjectEntry> {
    const run = this.queue.then(() => this.addNow(root));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async addNow(rootInput: string): Promise<ProjectEntry> {
    const root = path.resolve(rootInput);
    const id = projectId(root);
    for (let attempt = 0; attempt < 5; attempt++) {
      const { entries, raw, corrupt, text } = await this.read();
      const existing = entries.find((e) => e.id === id);
      if (existing) return existing;
      const project = await loadProject(root);
      const entry: ProjectEntry = { id, name: project.config?.name || path.basename(root), root };
      const next = JSON.stringify([...raw, entry], null, 2) + '\n';
      if (corrupt && text !== null) await fs.writeFile(this.file + '.bak', text, 'utf8'); // keep the bad file before replacing it
      if (text === null) {
        // First write: temp file, then a link that fails rather than overwrite a file created meanwhile.
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.${randomBytes(6).toString('hex')}.tmp`;
        await fs.writeFile(tmp, next, 'utf8');
        try {
          await fs.link(tmp, this.file);
          return entry;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'EEXIST') continue;
          await fs.rename(tmp, this.file); // hard links unsupported here
          return entry;
        } finally {
          await fs.rm(tmp, { force: true });
        }
      }
      const res = await writeIfUnchanged(this.file, hashText(text), () => next);
      if (res.ok) return entry;
    }
    throw new Error('Could not update the project registry');
  }
}
