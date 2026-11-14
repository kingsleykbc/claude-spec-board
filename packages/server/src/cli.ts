import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadProject, renderTree } from '@specboard/core';
import { pluginDir } from './paths.js';
import { initHint } from './prePublish.js';
import { allowCommand, initCommand, terminalIO } from './setup.js';
import { isSpecBoard, start, type StartOptions } from './start.js';

export function parseArgs(argv: string[]): { path: string; port: number; open: boolean; detach: boolean } {
  // npm runs root scripts from the repo root; INIT_CWD is where the user typed the command.
  const base = process.env.INIT_CWD || process.cwd();
  let dir = base;
  let port = 4949;
  let open = true;
  let detach = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--no-open') open = false;
    else if (a === '--detach') detach = true;
    else if (a === '--no-detach') detach = false;
    else if (a === '--port') {
      const raw = argv[++i];
      const n = Number(raw);
      if (raw === undefined || !Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`Invalid port: ${raw ?? '(missing)'}`);
      port = n;
    } else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else dir = path.resolve(base, a);
  }
  return { path: dir, port, open, detach };
}

export function parseInitArgs(argv: string[]): { path: string; yes: boolean; forceSkills: boolean; noSkills: boolean; runs?: 'yes' | 'no' } {
  const base = process.env.INIT_CWD || process.cwd();
  let dir = base;
  let yes = false;
  let forceSkills = false;
  let noSkills = false;
  let runs: 'yes' | 'no' | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--yes') yes = true;
    else if (a === '--force-skills') forceSkills = true;
    else if (a === '--no-skills') noSkills = true;
    else if (a === '--runs') {
      const v = argv[++i];
      if (v !== 'yes' && v !== 'no') throw new Error(`--runs needs yes or no, got ${v ?? '(missing)'}`);
      runs = v;
    } else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else dir = path.resolve(base, a);
  }
  return { path: dir, yes, forceSkills, noSkills, runs };
}

export function parseAllowArgs(argv: string[]): { rule: string; path: string } {
  const base = process.env.INIT_CWD || process.cwd();
  const rest = argv.filter((a) => !a.startsWith('--'));
  const bad = argv.find((a) => a.startsWith('--'));
  if (bad) throw new Error(`Unknown option: ${bad} (specboard allow always asks you; there is no --yes)`);
  if (rest.length < 1 || rest.length > 2) throw new Error('Usage: specboard allow <rule> [path]');
  return { rule: rest[0]!, path: rest[1] ? path.resolve(base, rest[1]) : base };
}

export function parseTreeArgs(argv: string[]): { path: string; spec?: string; milestone?: string } {
  const base = process.env.INIT_CWD || process.cwd();
  let dir = base;
  let spec: string | undefined;
  let milestone: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--spec' || a === '--milestone') {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      if (a === '--spec') spec = v;
      else milestone = v;
    } else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else dir = path.resolve(base, a);
  }
  return { path: dir, spec, milestone };
}

/** The arguments for the detached child: the same as ours, without --detach, plus --no-detach. */
export function detachArgs(argv: string[]): string[] {
  return [...argv.filter((a) => a !== '--detach' && a !== '--no-detach'), '--no-detach'];
}

/** Version of the Spec Board plugin, read from its manifest. */
export function pluginVersion(): string {
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir(), '.claude-plugin', 'plugin.json'), 'utf8')) as { version?: string };
  return manifest.version ?? 'unknown';
}

/** Start the child that keeps serving after this process exits. */
function spawnDetached(argv: string[]): void {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, ...detachArgs(argv)], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

/**
 * `--detach`: if a board already serves on the port, register the project and open it. Otherwise start a detached
 * copy of ourselves and wait up to `timeoutMs` for it to answer. Returns the exit code.
 */
export async function runDetached(
  a: Pick<StartOptions, 'path' | 'port' | 'open'>,
  argv: string[],
  deps: { spawn?: (argv: string[]) => void; timeoutMs?: number } = {},
): Promise<number> {
  if (a.port !== 0 && (await isSpecBoard(a.port))) {
    const s = await start(a); // registers the project and opens the board; nothing new is served
    console.log(`Spec Board running at ${s.url}`);
    return 0;
  }
  const root = path.resolve(a.path);
  if (!fs.existsSync(path.join(root, '.specboard', 'config.md'))) throw new Error(`No .specboard folder in ${root}. ${initHint(root)}`);
  if (a.port === 0) throw new Error('--detach needs a fixed port; leave out --port 0.');
  (deps.spawn ?? spawnDetached)(argv);
  const deadline = Date.now() + (deps.timeoutMs ?? 10_000);
  while (Date.now() < deadline) {
    if (await isSpecBoard(a.port)) {
      console.log(`Spec Board running at http://127.0.0.1:${a.port}`);
      return 0;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.error(`Spec Board did not start within ${(deps.timeoutMs ?? 10_000) / 1000} s. Run it in the foreground to see why: specboard "${root}"`);
  return 1;
}

const shuttingDown = new WeakSet<object>();

/** Close once, then exit 0; a failure or a close that hangs past 5 s exits 1. A repeat call is ignored. */
export function shutdown(close: () => Promise<void>, exit: (code: number) => never = process.exit): void {
  if (shuttingDown.has(close)) return;
  shuttingDown.add(close);
  const timer = setTimeout(() => {
    console.error('Shutdown timed out');
    exit(1);
  }, 5000);
  timer.unref();
  close().then(
    () => {
      clearTimeout(timer);
      exit(0);
    },
    (e: unknown) => {
      clearTimeout(timer);
      console.error(e instanceof Error ? e.message : String(e));
      exit(1);
    },
  );
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === '--version') {
    console.log(pluginVersion());
    return;
  }
  if (cmd === 'init') {
    const a = parseInitArgs(rest);
    await initCommand({ root: a.path, yes: a.yes, forceSkills: a.forceSkills, noSkills: a.noSkills, runs: a.runs }, terminalIO());
    return;
  }
  if (cmd === 'allow') {
    const a = parseAllowArgs(rest);
    await allowCommand({ rule: a.rule, root: a.path }, terminalIO());
    return;
  }
  if (cmd === 'tree') {
    const a = parseTreeArgs(rest);
    const project = await loadProject(a.path);
    if (project.config === null && project.specs.length === 0 && project.problems[0] === 'No .specboard folder') throw new Error(`No .specboard folder in ${a.path}`);
    console.log(renderTree(project, { spec: a.spec, milestone: a.milestone }));
    return;
  }
  const args = parseArgs(process.argv.slice(2));
  if (args.detach) {
    process.exit(await runDetached(args, process.argv.slice(2)));
  }
  const { url, close } = await start(args);
  console.log(`Spec Board running at ${url}`);
  const stop = () => shutdown(close);
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
