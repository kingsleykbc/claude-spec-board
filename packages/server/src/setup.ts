import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { initProject } from '@specboard/core';
import { matchesDeny } from './claude/classify.js';
import { assertNoLinks, installSkills } from './kit.js';
import { projectId, Registry } from './registry.js';

export interface Permissions {
  allow: string[];
  deny: string[];
}

/** Directory holding `projects.json` and `permissions.json`: `$SPECBOARD_HOME`, else `~/.specboard`. */
export function specboardHome(): string {
  return process.env.SPECBOARD_HOME ?? path.join(os.homedir(), '.specboard');
}

const unique = (xs: string[]): string[] => [...new Set(xs)];

// ---------- rules ----------

const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const FILE_TOOLS = new Set(['Read', 'Edit', 'Write']);
const ANY_SPEC = new Set(['*', ':*', '*:*', '**', '/**', '//**']);

/**
 * A rule we are willing to put on the approved list: `Tool` or `Tool(specifier)`, one line, and not a blanket.
 * Bash and PowerShell need a command prefix; Read, Edit and Write need a path scope. Widening is only by a scoped rule.
 */
export function isValidRule(rule: string): boolean {
  if (typeof rule !== 'string' || /[\r\n]/.test(rule)) return false;
  const m = /^([A-Za-z0-9_]+)(?:\((.+)\))?$/.exec(rule.trim());
  if (!m) return false;
  const tool = m[1]!;
  const spec = m[2]?.trim();
  if (SHELL_TOOLS.has(tool) || FILE_TOOLS.has(tool)) {
    if (spec === undefined || spec === '' || ANY_SPEC.has(spec)) return false;
  }
  return true;
}

function assertAllowable(rule: string, deny: string[]): void {
  if (!isValidRule(rule)) throw new Error(`"${rule}" is not a valid permission rule (use for example Bash(npm run lint:*)).`);
  if (matchesDeny(rule, deny)) throw new Error(`"${rule}" is blocked by policy: it overlaps this project's deny list.`);
}

// ---------- default list ----------

const BASE_ALLOW = [
  'Read(./**)', 'Glob', 'Grep', 'Edit(./**)', 'Write(./**)',
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add:*)', 'Bash(git commit:*)',
];
const DENY = [
  'Bash(git push:*)', 'Bash(git reset:*)', 'Bash(rm -rf:*)',
  'PowerShell(git push:*)', 'PowerShell(git reset:*)',
  'Edit(./.claude/**)', 'Write(./.claude/**)',
];

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** The conservative default rules, plus the test commands this project appears to use. */
export async function defaultAllowList(root: string): Promise<Permissions> {
  const allow = [...BASE_ALLOW];
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> };
    if (typeof pkg?.scripts?.test === 'string') allow.push('Bash(npm test:*)', 'Bash(npm run test:*)');
  } catch {
    // no package.json, or not readable JSON: no npm test rule
  }
  if ((await exists(path.join(root, 'pyproject.toml'))) || (await exists(path.join(root, 'pytest.ini')))) allow.push('Bash(pytest:*)');
  if (await exists(path.join(root, 'Cargo.toml'))) allow.push('Bash(cargo test:*)');
  if (await exists(path.join(root, 'go.mod'))) allow.push('Bash(go test:*)');
  return { allow, deny: [...DENY] };
}

// ---------- files ----------

/** Temp file in the same folder, then rename over the target. */
async function writeAtomic(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tmp, text, 'utf8');
    await fs.rename(tmp, file);
  } catch (e) {
    await fs.rm(tmp, { force: true });
    throw e;
  }
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function isPermissions(v: unknown): v is Permissions {
  return typeof v === 'object' && v !== null && isStrings((v as Permissions).allow) && isStrings((v as Permissions).deny);
}

/**
 * The permissions a human approved, keyed by project ID, in one file outside every project
 * (normally `~/.specboard/permissions.json`). Nothing here reads a project's own settings.
 */
export class ApprovedPermissions {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async read(): Promise<Record<string, Permissions>> {
    let text: string;
    try {
      text = await fs.readFile(this.file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw e;
    }
    const bad = (why: string) => new Error(`${this.file} is not a valid approved-permissions file (${why}). Fix or delete it; Spec Board will not guess.`);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw bad('not JSON');
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw bad('expected an object keyed by project ID');
    for (const [id, p] of Object.entries(data)) if (!isPermissions(p)) throw bad(`entry ${id} needs allow and deny lists`);
    return data as Record<string, Permissions>;
  }

  async get(pid: string): Promise<Permissions | null> {
    return (await this.read())[pid] ?? null;
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async set(pid: string, p: Permissions): Promise<void> {
    const allow = unique(p.allow);
    const deny = unique(p.deny);
    for (const r of allow) assertAllowable(r, deny);
    return this.serial(async () => {
      const all = await this.read();
      all[pid] = { allow, deny };
      await writeAtomic(this.file, JSON.stringify(all, null, 2) + '\n');
    });
  }

  async addAllow(pid: string, rule: string): Promise<void> {
    return this.serial(async () => {
      const all = await this.read();
      const entry = all[pid];
      if (!entry) throw new Error('This project is not approved yet. Run `specboard init` first.');
      assertAllowable(rule, entry.deny);
      if (entry.allow.includes(rule)) return;
      all[pid] = { allow: [...entry.allow, rule], deny: entry.deny };
      await writeAtomic(this.file, JSON.stringify(all, null, 2) + '\n');
    });
  }
}

/** Add our rules to `<root>/.claude/settings.json`, keeping every other key and rule. Never writes through a link. */
export async function mergeClaudeSettings(root: string, p: Permissions): Promise<void> {
  const realRoot = await fs.realpath(root);
  await assertNoLinks(realRoot, ['.claude', 'settings.json'], 'update settings');
  const file = path.join(realRoot, '.claude', 'settings.json');
  let settings: Record<string, unknown> = {};
  let text: string | null = null;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  if (text !== null) {
    const bad = (why: string) => new Error(`${file} ${why}. Fix it by hand; Spec Board did not change it.`);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw bad('is not valid JSON');
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw bad('is not a JSON object');
    settings = data as Record<string, unknown>;
    const perms = settings.permissions;
    if (perms !== undefined && (typeof perms !== 'object' || perms === null || Array.isArray(perms))) throw bad('has a "permissions" that is not an object');
    for (const k of ['allow', 'deny']) {
      const v = (perms as Record<string, unknown> | undefined)?.[k];
      if (v !== undefined && !isStrings(v)) throw bad(`has a "permissions.${k}" that is not a list of strings`);
    }
  }
  const perms = { ...((settings.permissions as Record<string, unknown> | undefined) ?? {}) };
  perms.allow = unique([...((perms.allow as string[] | undefined) ?? []), ...p.allow]);
  perms.deny = unique([...((perms.deny as string[] | undefined) ?? []), ...p.deny]);
  await writeAtomic(file, JSON.stringify({ ...settings, permissions: perms }, null, 2) + '\n');
}

// ---------- commands ----------

export interface SetupIO {
  isTTY: boolean;
  confirm(question: string): Promise<boolean>;
  log(line: string): void;
}

/** The real terminal: y or yes answers true, anything else false. */
export function terminalIO(): SetupIO {
  return {
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    log: (l) => console.log(l),
    confirm: async (q) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return /^y(es)?$/i.test((await rl.question(q)).trim());
      } finally {
        rl.close();
      }
    },
  };
}

function approvedStore(): ApprovedPermissions {
  return new ApprovedPermissions(path.join(specboardHome(), 'permissions.json'));
}

export async function initCommand(
  opts: { root: string; yes: boolean; forceSkills: boolean },
  io: SetupIO,
): Promise<{ approved: boolean; id: string }> {
  const root = path.resolve(opts.root);
  if (!opts.yes && !io.isTTY) {
    throw new Error('specboard init asks you to approve permissions and needs a terminal. Run it in one, or pass --yes to approve the default list.');
  }
  if (!(await fs.stat(root).catch(() => null))?.isDirectory()) throw new Error(`${root} is not a folder.`);

  // Skills first: if a link blocks the install, nothing else has changed yet.
  const skills = await installSkills(root, { force: opts.forceSkills });
  await initProject(root, path.basename(root));
  const id = (await new Registry(path.join(specboardHome(), 'projects.json')).add(root)).id;

  for (const s of skills) io.log(`skill ${s.name}: ${s.action}`);
  if (skills.some((s) => s.action === 'skipped-modified')) io.log('Some skills were edited and kept. Use --force-skills to replace them.');

  const defaults = await defaultAllowList(root);
  const store = approvedStore();
  const previous = await store.get(id);
  // Keep rules added earlier with `specboard allow`, unless the deny list now covers them.
  const deny = unique([...(previous?.deny ?? []), ...defaults.deny]);
  const allow = unique([...defaults.allow, ...(previous?.allow ?? []).filter((r) => !matchesDeny(r, deny))]);

  io.log('Headless runs may use:');
  for (const r of allow) io.log(`  allow  ${r}`);
  for (const r of deny) io.log(`  deny   ${r}`);
  const approved = opts.yes || (await io.confirm('Allow these actions for headless runs? [y/N] '));
  if (!approved) {
    io.log('Project set up, but runs are not approved. Run `specboard init` again to approve them.');
    return { approved: false, id };
  }
  await mergeClaudeSettings(root, { allow, deny }); // validates the project's settings before anything is approved
  await store.set(id, { allow, deny });
  io.log('Approved. Runs use only this list.');
  return { approved: true, id };
}

export async function allowCommand(opts: { rule: string; root: string }, io: SetupIO): Promise<void> {
  const root = path.resolve(opts.root);
  const rule = opts.rule.trim();
  const id = projectId(root);
  const store = approvedStore();
  const entry = await store.get(id);
  if (!entry) throw new Error(`${root} is not approved yet. Run \`specboard init\` first.`);
  assertAllowable(rule, entry.deny);
  // This is the one way to widen what runs can do, so it always needs a person at a terminal: there is no --yes.
  if (!io.isTTY) throw new Error('specboard allow needs a terminal and your answer; it cannot run without one.');
  if (!(await io.confirm(`Allow ${rule} for headless runs in ${root}? [y/N] `))) throw new Error(`Rule not added: ${rule}`);
  await mergeClaudeSettings(root, { allow: [rule], deny: [] }); // may refuse (links, bad JSON) before anything is approved
  await store.addAllow(id, rule);
  io.log(`Allowed ${rule}`);
}
