import os from 'node:os';
import path from 'node:path';
import spawn from 'cross-spawn';
import { Registry } from '../registry.js';
import { specboardHome } from '../setup.js';
import { droppedEntries, envKeys, killTree, resolveFromEnv, resolveOnlyInDropped, searchablePath } from './resolve.js';

export interface ClaudeStatus {
  installed: boolean;
  loggedIn: boolean;
  version: string | null;
  /** `claude` was found only inside a registered project, here, so it was not run. A terminal may still find it. */
  blockedBy?: string;
  /** `claude` was found outside but failed to start, with this folder left out of its PATH. That may or may not be why. */
  maybeBlockedBy?: string;
}
export type ClaudeRunner = (args: string[]) => Promise<{ code: number | null; stdout: string; maybeBlockedBy?: string }>;
/** `recheckIfDown`: don't trust a remembered "not installed" or "not logged in"; the person may have just fixed it. */
export type ClaudeStatusCheck = (opts?: { recheckIfDown?: boolean }) => Promise<ClaudeStatus>;
/** The folders no status check may run a program from. Rejects if they can't be known, which reads as not installed. */
export type ProjectRoots = () => Promise<string[]>;

/** While set, Windows and cmd.exe don't look in the current folder for a bare command: a `node.cmd` a repo ships, when a `claude.cmd` shim calls `node`. */
const NO_CWD_SEARCH = 'NoDefaultCurrentDirectoryInExePath';

const CACHE_MS = 30_000;
const COMMAND_TIMEOUT_MS = 20_000;

/** `CLAUDE_CODE_*` variables a person sets on purpose to log in or choose a provider. Names checked against code.claude.com/docs/en/env-vars. */
const KEEP_ENV = new Set([
  'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_OAUTH_REFRESH_TOKEN', 'CLAUDE_CODE_OAUTH_SCOPES',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_USE_MANTLE', 'CLAUDE_CODE_USE_ANTHROPIC_AWS',
  'CLAUDE_CODE_SKIP_BEDROCK_AUTH', 'CLAUDE_CODE_SKIP_VERTEX_AUTH', 'CLAUDE_CODE_SKIP_FOUNDRY_AUTH', 'CLAUDE_CODE_SKIP_MANTLE_AUTH', 'CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH',
  'CLAUDE_CODE_CLIENT_CERT', 'CLAUDE_CODE_CLIENT_KEY', 'CLAUDE_CODE_CLIENT_KEY_PASSPHRASE',
  'CLAUDE_CODE_GIT_BASH_PATH',
]);

/** Set by a Claude Code session for what it starts, or otherwise describing that session. */
function isSessionVar(key: string): boolean {
  if (key === 'CLAUDECODE' || key === 'CLAUDE_EFFORT' || key === 'CLAUDE_PID' || key.startsWith('CLAUDE_AGENT_SDK_')) return true;
  return key.startsWith('CLAUDE_CODE_') && !KEEP_ENV.has(key);
}

/**
 * This process's environment without a Claude Code session's variables, so a board started inside a session acts like
 * one from a plain terminal. Login and provider variables stay, and so does everything else, `ANTHROPIC_*` included.
 * PATH keeps only absolute entries outside `exclude`, so a shim's bare `node` can't reach a repo's script.
 */
export function childEnv(exclude: string[], source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(source)) {
    const upper = k.toUpperCase();
    if (!isSessionVar(upper) && upper !== NO_CWD_SEARCH.toUpperCase()) env[k] = v;
  }
  const [pathKey, ...others] = envKeys(env, 'PATH');
  if (pathKey !== undefined) env[pathKey] = searchablePath(env[pathKey], exclude);
  for (const k of others) delete env[k];
  if (process.platform === 'win32') env[NO_CWD_SEARCH] = '1';
  return env;
}

/** Every registered project's root, read fresh: another process (`init`, a second `start`) can add one at any time. */
export const registeredRoots: ProjectRoots = () => new Registry(path.join(specboardHome(), 'projects.json')).roots();

/** `name` was found only inside a registered project, so it was not run. */
class CommandBlockedError extends Error {
  constructor(name: string, readonly blockedBy: string) {
    super(`${name} not found outside the registered projects: ${blockedBy}`);
    this.name = 'CommandBlockedError';
  }
}

let warnedFor: string | null = null;

/** The board says "not found" where a terminal works, so say why. Once per set of registered projects. Starts nothing. */
function warnDropped(env: NodeJS.ProcessEnv, exclude: string[]): void {
  const key = JSON.stringify([...exclude].sort());
  if (key === warnedFor) return;
  warnedFor = key;
  for (const { dir, root } of droppedEntries(env, exclude)) {
    console.warn(`PATH entry ${dir} is inside the registered project ${root}, so the status check and runs leave it out.`);
  }
  for (const tool of ['git', 'node']) {
    const at = resolveOnlyInDropped(tool, env, exclude);
    if (at !== null) console.warn(`${tool} is only on PATH inside a registered project (${at}), so runs won't find it.`);
  }
}

/**
 * Runs `name` by the absolute path we found, never a bare name, so whatever folder the server started in can't supply it.
 * This runs when a project is opened, before any approval, so nothing inside any of `roots` counts: a `claude` found only
 * there reads as not installed. It starts in the temp folder, so the folder the server started in, perhaps a project, is
 * not its current folder either.
 */
export const commandRunner = (name: string, env: NodeJS.ProcessEnv, roots: ProjectRoots): ClaudeRunner => async (args) => {
  const exclude = await roots();
  warnDropped(env, exclude);
  const bin = resolveFromEnv(name, env, exclude);
  if (bin === null) {
    const inside = resolveOnlyInDropped(name, env, exclude);
    throw inside === null ? new Error(`${name} not found`) : new CommandBlockedError(name, inside);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: os.tmpdir(), env: childEnv(exclude), stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let stdout = '';
    const timer = setTimeout(() => {
      if (child.pid !== undefined) killTree(child.pid, 'SIGKILL');
      reject(new Error(`${name} ${args.join(' ')} timed out`));
    }, COMMAND_TIMEOUT_MS);
    child.stdout!.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const dropped = code === 0 ? undefined : droppedEntries(env, exclude)[0]; // a shim may have needed what was left out
      resolve({ code, stdout, ...(dropped ? { maybeBlockedBy: dropped.dir } : {}) });
    });
  });
};

const DOWN: ClaudeStatus = { installed: false, loggedIn: false, version: null };

async function check(run: ClaudeRunner): Promise<ClaudeStatus> {
  let version: string;
  try {
    const out = await run(['--version']);
    if (out.code !== 0) return out.maybeBlockedBy ? { ...DOWN, maybeBlockedBy: out.maybeBlockedBy } : DOWN;
    version = out.stdout.trim().split(/\s+/)[0] ?? '';
  } catch (e) {
    return e instanceof CommandBlockedError ? { ...DOWN, blockedBy: e.blockedBy } : DOWN;
  }
  const installed = { installed: true, version: version || null };
  try {
    const out = await run(['auth', 'status']);
    if (out.code !== 0) return { ...installed, loggedIn: false };
    let loggedIn = true; // exit 0 with an output we can't read: let the run itself report a login problem
    try {
      loggedIn = (JSON.parse(out.stdout) as { loggedIn?: unknown }).loggedIn !== false;
    } catch {
      // not JSON
    }
    return { ...installed, loggedIn };
  } catch {
    return { ...installed, loggedIn: false };
  }
}

/**
 * A status check that never throws, remembers its answer for 30 s and shares a check already in progress. The answer
 * belongs to the set of `roots` it was found under: when that changes, the program it ran may now be inside a project.
 */
export function makeClaudeStatus(run: ClaudeRunner, now: () => number = Date.now, roots: ProjectRoots = async () => []): ClaudeStatusCheck {
  let cached: { at: number; key: string; status: Promise<ClaudeStatus> } | null = null;
  const refresh = (key: string) => (cached = { at: now(), key, status: check(run) });
  return async (opts) => {
    let key: string;
    try {
      key = JSON.stringify((await roots()).sort());
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e)); // this answer says "not installed": the log says why
      return DOWN;
    }
    const stale = !cached || cached.key !== key || now() - cached.at >= CACHE_MS;
    const entry = stale ? refresh(key) : cached!;
    const status = await entry.status;
    if (!opts?.recheckIfDown || stale || (status.installed && status.loggedIn)) return status;
    return (cached === entry ? refresh(key) : cached!).status; // someone else may have re-checked meanwhile
  };
}

/** `claude --version` and `claude auth status`, never from inside a registered project. */
export const claudeStatus = makeClaudeStatus(commandRunner('claude', process.env, registeredRoots), Date.now, registeredRoots);
