import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { archiveSpec, loadProject, renderTree } from '@specboard/core';
import { copyImagesCommand, parseCopyImagesArgs } from './copyImages.js';
import { pluginVersion } from './paths.js';
import { runTokenHook } from './hookTokens.js';
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

export function parseArchiveArgs(argv: string[]): { id: string; path: string } {
  const base = process.env.INIT_CWD || process.cwd();
  const bad = argv.find((a) => a.startsWith('--'));
  if (bad) throw new Error(`Unknown option: ${bad}`);
  if (argv.length < 1 || argv.length > 2) throw new Error('Usage: specboard archive <ID> [project folder]');
  return { id: argv[0]!, path: argv[1] ? path.resolve(base, argv[1]) : base };
}

/**
 * Move a spec to the archive, from any status (the same as the board's Archive button). Returns the exit code.
 * It cannot tell whether a board run is working on the spec (that lives in the board's own process), so only the
 * board's archive button refuses during a run.
 */
export async function archiveCommand(a: { id: string; path: string }, log: (m: string) => void = console.log, err: (m: string) => void = console.error): Promise<number> {
  const project = await loadProject(a.path);
  if (project.config === null && project.specs.length === 0 && project.problems[0] === 'No .specboard folder') {
    err(`No .specboard folder in ${a.path}`);
    return 1;
  }
  if (project.archived.some((s) => s.id === a.id) && !project.specs.some((s) => s.id === a.id)) {
    log(`${a.id} is already archived.`);
    return 0;
  }
  if (!project.specs.some((s) => s.id === a.id)) {
    err(`No spec ${a.id} in ${a.path}`);
    return 1;
  }
  await archiveSpec(a.path, a.id, { anyStatus: true });
  log(`Archived ${a.id}.`);
  return 0;
}

/** The arguments for the detached child: the same as ours, without --detach, plus --no-detach. */
export function detachArgs(argv: string[]): string[] {
  return [...argv.filter((a) => a !== '--detach' && a !== '--no-detach'), '--no-detach'];
}

export { pluginVersion };

/** Start the child that keeps serving after this process exits. */
function spawnDetached(argv: string[]): { exited(): boolean } {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, ...detachArgs(argv)], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  let exited = false;
  child.once('exit', () => { exited = true; });
  child.unref();
  return { exited: () => exited };
}

/** True when nothing is listening on `port` (a probe bind on the board's host). */
async function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

/**
 * `--detach`: if a board already serves on the port, register the project and open it. Otherwise start a detached
 * copy of ourselves and wait up to `timeoutMs` for it to answer. Returns the exit code.
 */
export async function runDetached(
  a: Pick<StartOptions, 'path' | 'port' | 'open'>,
  argv: string[],
  deps: { spawn?: (argv: string[]) => { exited(): boolean } | void; timeoutMs?: number } = {},
): Promise<number> {
  if (a.port !== 0 && (await isSpecBoard(a.port))) {
    const s = await start(a); // registers the project and opens the board; nothing new is served
    console.log(`Spec Board running at ${s.url}`);
    return 0;
  }
  if (a.port === 0) throw new Error('--detach needs a fixed port; leave out --port 0.');
  const root = path.resolve(a.path);
  if (!fs.existsSync(path.join(root, '.specboard', 'config.md'))) throw new Error(`No .specboard folder in ${root}. ${initHint(root)}`);
  if (!(await portIsFree(a.port))) throw new Error(`Port ${a.port} is in use by another program. Pick another with --port.`);
  const child = (deps.spawn ?? spawnDetached)(argv);
  const deadline = Date.now() + (deps.timeoutMs ?? 10_000);
  while (Date.now() < deadline) {
    if (child?.exited()) break;
    if (await isSpecBoard(a.port)) {
      console.log(`Spec Board running at http://127.0.0.1:${a.port}`);
      return 0;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.error(`Spec Board did not start on port ${a.port} within ${(deps.timeoutMs ?? 10_000) / 1000} s. Run it in the foreground to see why: specboard "${root}"`);
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
  if (cmd === 'hook-tokens') {
    // Never fail and never print: a hook must not disturb Claude.
    try {
      const chunks: Buffer[] = [];
      for await (const c of process.stdin) chunks.push(c as Buffer);
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      await runTokenHook(input, { dataDir: process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.specboard', 'plugin-data') });
    } catch {
      // swallowed on purpose
    }
    process.exit(0);
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
  if (cmd === 'archive') {
    process.exit(await archiveCommand(parseArchiveArgs(rest)));
  }
  if (cmd === 'copy-images') {
    process.exit(await copyImagesCommand(parseCopyImagesArgs(rest)));
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
