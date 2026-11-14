import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadProject, renderTree } from '@specboard/core';
import { allowCommand, initCommand, terminalIO } from './setup.js';
import { start } from './start.js';

export function parseArgs(argv: string[]): { path: string; port: number; open: boolean } {
  // npm runs root scripts from the repo root; INIT_CWD is where the user typed the command.
  const base = process.env.INIT_CWD || process.cwd();
  let dir = base;
  let port = 4949;
  let open = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--no-open') open = false;
    else if (a === '--port') {
      const raw = argv[++i];
      const n = Number(raw);
      if (raw === undefined || !Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`Invalid port: ${raw ?? '(missing)'}`);
      port = n;
    } else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else dir = path.resolve(base, a);
  }
  return { path: dir, port, open };
}

export function parseInitArgs(argv: string[]): { path: string; yes: boolean; forceSkills: boolean } {
  const base = process.env.INIT_CWD || process.cwd();
  let dir = base;
  let yes = false;
  let forceSkills = false;
  for (const a of argv) {
    if (a === '--yes') yes = true;
    else if (a === '--force-skills') forceSkills = true;
    else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else dir = path.resolve(base, a);
  }
  return { path: dir, yes, forceSkills };
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
  if (cmd === 'init') {
    const a = parseInitArgs(rest);
    await initCommand({ root: a.path, yes: a.yes, forceSkills: a.forceSkills }, terminalIO());
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
  const { url, close } = await start(parseArgs(process.argv.slice(2)));
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
