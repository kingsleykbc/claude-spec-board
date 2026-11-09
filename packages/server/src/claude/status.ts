import spawn from 'cross-spawn';
import treeKill from 'tree-kill';

export interface ClaudeStatus { installed: boolean; loggedIn: boolean; version: string | null }
export type ClaudeRunner = (args: string[]) => Promise<{ code: number | null; stdout: string }>;

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
 */
export function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!isSessionVar(k.toUpperCase())) env[k] = v;
  }
  return env;
}

const runClaude: ClaudeRunner = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn('claude', args, { env: childEnv(), stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let stdout = '';
    const timer = setTimeout(() => {
      if (child.pid !== undefined) treeKill(child.pid, 'SIGKILL', () => undefined);
      reject(new Error(`claude ${args.join(' ')} timed out`));
    }, COMMAND_TIMEOUT_MS);
    child.stdout!.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout });
    });
  });

async function check(run: ClaudeRunner): Promise<ClaudeStatus> {
  const down: ClaudeStatus = { installed: false, loggedIn: false, version: null };
  let version: string;
  try {
    const out = await run(['--version']);
    if (out.code !== 0) return down;
    version = out.stdout.trim().split(/\s+/)[0] ?? '';
  } catch {
    return down;
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

/** A status check that never throws, remembers its answer for 30 s and shares a check already in progress. */
export function makeClaudeStatus(run: ClaudeRunner, now: () => number = Date.now): () => Promise<ClaudeStatus> {
  let cached: { at: number; status: Promise<ClaudeStatus> } | null = null;
  return () => {
    if (!cached || now() - cached.at >= CACHE_MS) cached = { at: now(), status: check(run) };
    return cached.status;
  };
}

/** `claude --version` and `claude auth status`. */
export const claudeStatus = makeClaudeStatus(runClaude);
