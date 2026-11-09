import fs from 'node:fs/promises';
import path from 'node:path';
import { hashText } from './hash.js';
import { specBodyMd } from './edit.js';
import { withRetry } from './retry.js';
import { parseSpec } from './parseSpec.js';
import { parseConfig, parseLog, parseOverview, type Overview, type ProjectConfig, type SubtaskLog } from './parseOther.js';
import type { SpecDoc } from './types.js';

export { hashText } from './hash.js';

export interface Spec extends SpecDoc {
  dir: string;
  path: string;
  hash: string;
  archived: boolean;
  slug: string;
  dependents: string[];
  blocked: boolean;
  blockedReasons: string[];
  progress: { done: number; total: number };
  logs: Record<number, SubtaskLog>;
  /** Body Markdown without Open questions and Subtasks; what the SPEC panel shows and edits. */
  bodyMd: string;
  /** `hashText(bodyMd)`: changes only when the editable body changes, not front matter, questions or subtasks. */
  bodyHash: string;
}

export interface Project {
  root: string;
  config: ProjectConfig | null;
  overview: Overview | null;
  specs: Spec[];
  archived: Spec[];
  problems: string[];
}

interface DerivedState { dependents: string[]; blocked: boolean; blockedReasons: string[] }

/** Compare IDs like `T-999` and `T-1000` by prefix, then number. */
export function compareIds(a: string, b: string): number {
  const pa = /^(.*?)(\d+)$/.exec(a);
  const pb = /^(.*?)(\d+)$/.exec(b);
  if (pa && pb) {
    if (pa[1] !== pb[1]) return pa[1]! < pb[1]! ? -1 : 1;
    const d = Number(pa[2]) - Number(pb[2]);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

const byId = (a: { id: string }, b: { id: string }): number => compareIds(a.id, b.id);

/**
 * Derive dependents and blocked state. Looks at direct dependencies only (no recursion),
 * so self-dependencies and cycles terminate. Archived specs count as done.
 */
export function deriveState(active: SpecDoc[], archived: SpecDoc[]): Map<string, DerivedState> {
  const all = new Map<string, SpecDoc>();
  for (const s of archived) all.set(s.id, s);
  for (const s of active) all.set(s.id, s);
  const archivedIds = new Set(archived.map((s) => s.id));

  const result = new Map<string, DerivedState>();
  for (const s of [...archived, ...active]) result.set(s.id, { dependents: [], blocked: false, blockedReasons: [] });

  for (const s of [...archived, ...active]) {
    const state = result.get(s.id)!;
    const open = s.questions.filter((q) => q.required && q.answer === null).length;
    if (open > 0) state.blockedReasons.push(open === 1 ? '1 open question' : `${open} open questions`);
    for (const dep of s.dependsOn) {
      if (dep === s.id) {
        state.blockedReasons.push('Depends on itself');
        continue;
      }
      const target = all.get(dep);
      if (!target) {
        state.blockedReasons.push(`${dep} not found`);
        continue;
      }
      result.get(dep)!.dependents.push(s.id);
      if (!archivedIds.has(dep) && target.status !== 'done') {
        state.blockedReasons.push(`Waiting on ${dep} (${target.status})`);
      }
    }
    state.blocked = state.blockedReasons.length > 0;
  }
  for (const state of result.values()) state.dependents = [...new Set(state.dependents)].sort();
  return result;
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await withRetry(() => fs.readFile(file, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

const FOLDER_ID = /^([A-Za-z]+-\d+)(?:-(.*))?$/;

async function loadLogs(dir: string, problems: string[]): Promise<Record<number, SubtaskLog>> {
  const logs: Record<number, SubtaskLog> = {};
  let names: string[];
  try {
    names = await fs.readdir(path.join(dir, 'logs'));
  } catch {
    return logs;
  }
  for (const name of names.sort()) {
    const m = /^(\d+)-.*\.md$/i.exec(name);
    if (!m) continue;
    try {
      const text = await withRetry(() => fs.readFile(path.join(dir, 'logs', name), 'utf8'));
      logs[Number(m[1])] = parseLog(text);
    } catch (e) {
      problems.push(`Cannot read log ${name}: ${(e as Error).message}`);
    }
  }
  return logs;
}

type RawSpec = Omit<Spec, 'dependents' | 'blocked' | 'blockedReasons'>;

async function loadSpecFolder(root: string, kind: 'specs' | 'archive', folder: string, archived: boolean, projectProblems: string[]): Promise<RawSpec | null> {
  const rel = `${kind}/${folder}`;
  const dir = path.join(root, '.specboard', kind, folder);
  try {
    const file = path.join(dir, 'spec.md');
    const text = await readIfExists(file);
    if (text === null) {
      projectProblems.push(`${rel}: missing spec.md`);
      return null;
    }
    const doc = parseSpec(text);
    const fm = FOLDER_ID.exec(folder);
    if (doc.id === '' && fm) doc.id = fm[1]!;
    const slug = doc.id !== '' && folder.startsWith(`${doc.id}-`) ? folder.slice(doc.id.length + 1) : (fm?.[2] ?? folder);
    const logs = await loadLogs(dir, doc.problems);
    for (const st of doc.subtasks) st.hasLog = logs[st.n] !== undefined;
    const bodyMd = specBodyMd(text);
    return {
      ...doc,
      dir,
      path: file,
      hash: hashText(text),
      archived,
      slug,
      progress: { done: doc.subtasks.filter((s) => s.done).length, total: doc.subtasks.length },
      logs,
      bodyMd,
      bodyHash: hashText(bodyMd),
    };
  } catch (e) {
    projectProblems.push(`${rel}: ${(e as Error).message}`);
    return null;
  }
}

/** Load a project from disk. Never throws. */
export async function loadProject(root: string): Promise<Project> {
  const sb = path.join(root, '.specboard');
  try {
    const st = await fs.stat(sb);
    if (!st.isDirectory()) throw new Error('not a directory');
  } catch {
    return { root, config: null, overview: null, specs: [], archived: [], problems: ['No .specboard folder'] };
  }

  const problems: string[] = [];
  let config: ProjectConfig | null = null;
  let overview: Overview | null = null;
  try {
    const t = await readIfExists(path.join(sb, 'config.md'));
    if (t !== null) config = parseConfig(t);
    else problems.push('Missing config.md');
  } catch (e) {
    problems.push(`config.md: ${(e as Error).message}`);
  }
  try {
    const t = await readIfExists(path.join(sb, 'overview.md'));
    if (t !== null) overview = parseOverview(t);
  } catch (e) {
    problems.push(`overview.md: ${(e as Error).message}`);
  }

  const collect = async (kind: 'specs' | 'archive', archived: boolean): Promise<RawSpec[]> => {
    const out: RawSpec[] = [];
    for (const folder of await listDirs(path.join(sb, kind))) {
      const s = await loadSpecFolder(root, kind, folder, archived, problems);
      if (s) out.push(s);
    }
    return out.sort(byId);
  };
  const rawActive = await collect('specs', false);
  const rawArchived = await collect('archive', true);

  const seen = new Map<string, RawSpec[]>();
  for (const s of [...rawActive, ...rawArchived]) {
    if (s.id === '') {
      problems.push(`Spec folder ${path.basename(s.dir)} has no id`);
      continue;
    }
    seen.set(s.id, [...(seen.get(s.id) ?? []), s]);
  }
  for (const [id, group] of seen) {
    if (group.length > 1) for (const s of group) s.problems.push(`Duplicate id ${id}`);
  }

  const state = deriveState(rawActive, rawArchived);
  const finish = (s: RawSpec): Spec => ({ ...s, ...(state.get(s.id) ?? { dependents: [], blocked: false, blockedReasons: [] }) });
  return { root, config, overview, specs: rawActive.map(finish), archived: rawArchived.map(finish), problems };
}
