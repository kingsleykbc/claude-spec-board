import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { initProject } from '@specboard/core';
import { matchesDeny, NEVER_PREFIX, normProg } from './claude/classify.js';
import { assertNoLinks, installSkills, kitPluginDir } from './kit.js';
import { initHint, nextLine } from './prePublish.js';
import { projectId, Registry } from './registry.js';
import { isWithin, realPathLoose } from './safePath.js';

export interface Permissions {
  allow: string[];
  deny: string[];
}

/** Directory holding `projects.json` and `permissions.json`, always absolute: `$SPECBOARD_HOME` if set and not empty, else `~/.specboard`. */
export function specboardHome(): string {
  return path.resolve(process.env.SPECBOARD_HOME || path.join(os.homedir(), '.specboard'));
}

/** A home inside a project is inside its `Write(./**)`: a spec could tell Claude to add a rule, and the next run would have it. */
const holdsFolder = (root: string, folder: string): boolean => isWithin(realPathLoose(root), realPathLoose(folder));

const unique = (xs: string[]): string[] => [...new Set(xs)];

// ---------- rules ----------

const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const FILE_TOOLS = new Set(['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const OTHER_TOOLS = ['Glob', 'Grep', 'WebFetch', 'WebSearch', 'Skill', 'Task', 'TodoWrite'];
const KNOWN_LOWER = new Set([...SHELL_TOOLS, ...FILE_TOOLS, ...OTHER_TOOLS].map((t) => t.toLowerCase()));

function validFileSpec(spec: string): boolean {
  if (!spec.startsWith('./')) return false;
  if (/[\\~:]/.test(spec)) return false; // backslash, home, drive letter
  if (spec.includes(',') || !/^[ -~]+$/.test(spec)) return false;
  let depth = 0; // parentheses inside the path must balance, so no second rule can hide after a ")"
  for (const ch of spec) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return false;
  }
  return depth === 0 && !spec.split('/').includes('..');
}

function validShellSpec(spec: string): boolean {
  if (spec === '' || spec !== spec.trim() || !/^[\x20-\x7e]+$/.test(spec)) return false;
  if (/["'`\\()$<>|&;]/.test(spec)) return false;
  const body = spec.endsWith(':*') ? spec.slice(0, -2) : spec;
  if (body.includes('*') || body === '') return false;
  const words = body.split(' ');
  const prog = words[0]!;
  if (!/^[A-Za-z0-9][\w.-]*$/.test(prog)) return false;
  const norm = normProg(prog);
  if (NEVER_PREFIX.has(norm) || norm === 'rm') return false; // rm: a deny list cannot enumerate its flags
  if (words.some((w) => w === '')) return false;
  return !(words[1] ?? '').startsWith('-');
}

/**
 * An allowlist, not a blocklist: only these shapes can reach the approved list.
 * File tools need a `./` path inside the project; Bash and PowerShell need a plain program name (not a shell or
 * wrapper, not `rm`), optional plain words, and `*` only as a final `:*`. Anything else is refused.
 */
export function isValidRule(rule: string): boolean {
  if (!isPlainRuleText(rule)) return false;
  const m = /^([A-Za-z0-9_]+)(?:\((.+)\))?$/.exec(rule);
  if (!m) return false;
  const tool = m[1]!;
  const spec = m[2];
  if (SHELL_TOOLS.has(tool)) return spec !== undefined && validShellSpec(spec);
  if (FILE_TOOLS.has(tool)) return spec !== undefined && validFileSpec(spec);
  if (KNOWN_LOWER.has(tool.toLowerCase()) && !OTHER_TOOLS.includes(tool)) return false; // wrong case
  if (tool.startsWith('mcp__')) return spec === undefined && /^mcp__[A-Za-z0-9_-]+$/.test(tool);
  if (!/^[A-Z][A-Za-z]+$/.test(tool)) return false;
  if (spec === undefined) return true;
  return tool === 'WebFetch' && /^domain:[A-Za-z0-9.-]+$/.test(spec);
}

/**
 * Printable ASCII with none of cmd.exe's metacharacters. Rules reach `claude` as an argument, and when `claude` is a
 * `.cmd` shim the shim's `%*` makes cmd.exe parse them again, past cross-spawn's escaping: `&` there runs a command.
 */
function isPlainRuleText(rule: string): boolean {
  return typeof rule === 'string' && /^[\x21-\x7e]([\x20-\x7e]*[\x21-\x7e])?$/.test(rule) && !/[&|<>^%"!`]/.test(rule);
}

/** What is wrong with a pair of lists, or null. Deny rules need no allow-rule shape (`Bash(rm -rf:*)` is a fine thing to refuse). */
function permissionsProblem(p: Permissions): string | null {
  for (const r of p.deny) if (!isPlainRuleText(r)) return `deny rule "${r}" is not valid`;
  for (const r of p.allow) {
    if (!isValidRule(r)) return `allow rule "${r}" is not valid`;
    if (matchesDeny(r, p.deny)) return `allow rule "${r}" overlaps the deny list`;
  }
  return null;
}

/** A stored approval that would no longer pass the rule checks. It is never used; `specboard init` repairs it. */
export class InvalidApprovalError extends Error {
  constructor(problem: string) {
    super(`The approved rules for this project can't be used: ${problem}. ${initHint()}`);
    this.name = 'InvalidApprovalError';
  }
}

function assertAllowable(rule: string, deny: string[]): void {
  if (!isValidRule(rule)) throw new Error(`"${rule}" is not a valid permission rule (use for example Bash(npm run lint:*)).`);
  if (matchesDeny(rule, deny)) throw new Error(`"${rule}" is blocked by policy: it overlaps this project's deny list.`);
}

// ---------- default list ----------

const BASE_ALLOW = [
  'Read(./**)', 'Edit(./**)', 'Write(./**)',
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add:*)', 'Bash(git commit:*)',
  'Bash(specboard tree:*)', 'Bash(gh pr view:*)', 'Bash(glab mr view:*)',
];
const DENY = [
  'Bash(git push:*)', 'Bash(git reset:*)', 'Bash(rm -rf:*)',
  'PowerShell(git push:*)', 'PowerShell(git reset:*)',
  'Edit(./.claude/**)', 'Write(./.claude/**)',
  'Edit(./.git/**)', 'Write(./.git/**)', // hooks and config under .git would run code outside any rule
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

type Stored = Permissions & { root: string };

function isStored(v: unknown): v is Stored {
  return typeof v === 'object' && v !== null && isStrings((v as Stored).allow) && isStrings((v as Stored).deny) && typeof (v as Stored).root === 'string';
}

/** The real path of a project folder, as stored with its approval. */
async function canonRoot(root: string): Promise<string> {
  return fs.realpath(path.resolve(root));
}
const sameRoot = (a: string, b: string): boolean => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

/**
 * The permissions a human approved, keyed by project ID, in one file outside every project
 * (normally `~/.specboard/permissions.json`). Each entry also stores the folder's real path, and an entry only
 * counts for that folder: a retargeted link or an ID collision reads as "not approved". Nothing here reads a
 * project's own settings.
 */
export class ApprovedPermissions {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async read(): Promise<Record<string, Stored>> {
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
    for (const [id, e] of Object.entries(data)) if (!isStored(e)) throw bad(`entry ${id} needs allow and deny lists and a root`);
    return data as Record<string, Stored>;
  }

  /**
   * The approved lists for this project ID, or null if none, or if they were approved for a different folder.
   * Throws `InvalidApprovalError` if they would no longer pass the rule checks: the file may have been edited by hand.
   * A file inside the project also reads as not approved: a run could have written it.
   */
  async get(pid: string, root: string): Promise<Permissions | null> {
    if (holdsFolder(root, path.dirname(this.file))) return null;
    const p = await this.stored(pid, root);
    const problem = p && permissionsProblem(p);
    if (problem) throw new InvalidApprovalError(problem);
    return p;
  }

  /** The same lists unchecked, for `init` to review and repair. Do not run anything with these. */
  async stored(pid: string, root: string): Promise<Permissions | null> {
    const e = (await this.read())[pid];
    if (!e) return null;
    let real: string;
    try {
      real = await canonRoot(root);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; // the folder is gone: not approved
      throw err;
    }
    if (!sameRoot(e.root, real)) return null;
    return { allow: e.allow, deny: e.deny };
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async set(pid: string, root: string, p: Permissions): Promise<void> {
    const allow = unique(p.allow);
    const deny = unique(p.deny);
    for (const r of deny) if (!isPlainRuleText(r)) throw new Error(`"${r}" is not a valid deny rule.`);
    for (const r of allow) assertAllowable(r, deny);
    const real = await canonRoot(root);
    return this.serial(async () => {
      const all = await this.read();
      all[pid] = { allow, deny, root: real };
      await writeAtomic(this.file, JSON.stringify(all, null, 2) + '\n');
    });
  }

  async addAllow(pid: string, root: string, rule: string): Promise<void> {
    const real = await canonRoot(root);
    return this.serial(async () => {
      const all = await this.read();
      const entry = all[pid];
      if (!entry || !sameRoot(entry.root, real)) throw new Error(`This project is not approved yet. ${initHint(root)}`);
      assertAllowable(rule, entry.deny);
      if (entry.allow.includes(rule)) return;
      all[pid] = { ...entry, allow: [...entry.allow, rule] };
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

/** The approved-permissions store under `specboardHome()`; the server and `init` must agree on it. */
export function approvedStore(): ApprovedPermissions {
  return new ApprovedPermissions(path.join(specboardHome(), 'permissions.json'));
}

export async function initCommand(
  opts: { root: string; yes: boolean; forceSkills: boolean; noSkills?: boolean; runs?: 'yes' | 'no'; kitDir?: string },
  io: SetupIO,
): Promise<{ approved: boolean; id: string }> {
  const root = path.resolve(opts.root);
  if (!opts.yes && !opts.runs && !io.isTTY) {
    throw new Error('specboard init asks you to approve permissions and needs a terminal. Run it in one, or pass --yes to approve the default list.');
  }
  if (!(await fs.stat(root).catch(() => null))?.isDirectory()) throw new Error(`${root} is not a folder.`);
  if (holdsFolder(root, opts.kitDir ?? kitPluginDir())) {
    throw new Error(`${root} is Spec Board's own repo, or holds it, and setting it up would let runs rewrite the kit. Name the project to set up: npm run specboard -- init <project path>`);
  }
  if (holdsFolder(root, specboardHome())) {
    throw new Error(`Spec Board's approved list (${specboardHome()}) is inside this folder, so a run could change its own permissions. Set up a project folder that doesn't hold it, or point SPECBOARD_HOME somewhere else.`);
  }

  // Skills first: if a link blocks the install, nothing else has changed yet.
  const skills = opts.noSkills ? [] : await installSkills(root, { force: opts.forceSkills });
  // initProject writes through whatever is there, so refuse links under .specboard too.
  const realRoot = await fs.realpath(root);
  for (const parts of [['.specboard'], ['.specboard', 'config.md'], ['.specboard', 'specs'], ['.specboard', 'archive'], ['.specboard', 'overview.md']]) {
    await assertNoLinks(realRoot, parts, 'set up the project');
  }
  await initProject(root, path.basename(root));
  const id = (await new Registry(path.join(specboardHome(), 'projects.json')).add(root)).id;

  for (const s of skills) io.log(`skill ${s.name}: ${s.action}`);
  if (skills.some((s) => s.action === 'skipped-modified')) io.log('Some skills were edited and kept. Use --force-skills to replace them.');
  if (!(await exists(path.join(root, '.git')))) io.log(`Warning: no .git in ${root}. Runs commit per subtask and need a git repo, so run \`git init\` here unless this folder is inside one.`);

  const defaults = await defaultAllowList(root);
  const store = approvedStore();
  const previous = await store.stored(id, root);
  const keptDeny: string[] = [];
  for (const r of previous?.deny ?? []) {
    if (isPlainRuleText(r)) keptDeny.push(r);
    else io.log(`Dropping earlier deny rule ${r}: it no longer passes the rule checks.`);
  }
  // Keep rules added earlier with `specboard allow`, unless the deny list now covers them.
  const deny = unique([...keptDeny, ...defaults.deny]);
  const kept: string[] = [];
  for (const r of previous?.allow ?? []) {
    if (isValidRule(r) && !matchesDeny(r, deny)) kept.push(r);
    else io.log(`Dropping earlier rule ${r}: it no longer passes the rule checks.`);
  }
  const allow = unique([...defaults.allow, ...kept]);

  io.log('Headless runs may use:');
  for (const r of allow) io.log(`  allow  ${r}`);
  for (const r of deny) io.log(`  deny   ${r}`);
  const approved = opts.runs ? opts.runs === 'yes' : opts.yes || (await io.confirm('Allow these actions for headless runs? [y/N] '));
  if (!approved) {
    if (previous) {
      io.log(`Existing approval is unchanged. To revoke it, delete the "${id}" entry from ${path.join(specboardHome(), 'permissions.json')}.`);
    } else {
      io.log(`Project set up, but runs are not approved. To approve them: ${initHint(root)}`);
    }
    return { approved: false, id };
  }
  await mergeClaudeSettings(root, { allow, deny }); // validates the project's settings before anything is approved
  await store.set(id, root, { allow, deny });
  io.log('Approved. Runs use only this list.');
  io.log(nextLine(root));
  return { approved: true, id };
}

export async function allowCommand(opts: { rule: string; root: string }, io: SetupIO): Promise<void> {
  const root = path.resolve(opts.root);
  const rule = opts.rule.trim();
  const id = projectId(root);
  const store = approvedStore();
  const entry = await store.get(id, root);
  if (!entry) throw new Error(`${root} is not approved yet. ${initHint(root)}`);
  assertAllowable(rule, entry.deny);
  // This is the one way to widen what runs can do, so it always needs a person at a terminal: there is no --yes.
  if (!io.isTTY) throw new Error('specboard allow needs a terminal and your answer; it cannot run without one.');
  if (!(await io.confirm(`Allow ${rule} for headless runs in ${root}? [y/N] `))) throw new Error(`Rule not added: ${rule}`);
  await mergeClaudeSettings(root, { allow: [rule], deny: [] }); // may refuse (links, bad JSON) before anything is approved
  await store.addAllow(id, root, rule);
  io.log(`Allowed ${rule}`);
}
