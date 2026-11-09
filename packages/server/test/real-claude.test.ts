// The real check: spends real subscription usage on the user's default model. Run it with `npm run test:claude`.
// `npm test` never runs this file (vitest.config.ts excludes it), and it skips itself without the real config's variable.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProject, type Spec } from '@specboard/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RunManager, type RunEvent, type RunSnapshot } from '../src/claude/runs.js';
import { claudeStatus, registeredRoots } from '../src/claude/status.js';
import type { RunKind } from '../src/claude/classify.js';
import type { ProjectEntry } from '../src/registry.js';
import { allowCommand, approvedStore, initCommand, type SetupIO } from '../src/setup.js';

const REAL = process.env.SPECBOARD_REAL_CLAUDE === '1';
const status = REAL ? await claudeStatus() : null;
if (REAL && !status?.loggedIn) {
  console.warn(`Skipping the real Claude test: ${status?.installed ? 'run `claude` in a terminal and log in first' : '`claude` is not installed'}.`);
}

const TEE = path.resolve(import.meta.dirname, 'fixtures', 'claude', 'tee-claude.cjs');
const io: SetupIO = { isTTY: true, confirm: async () => true, log: () => undefined };

let tmp: string;
let runs: RunManager;
let events: RunEvent[];
let captureNo = 0;
let lastCapture = '';
const captures: { label: string; file: string }[] = [];

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function specText(id: string, title: string, body: string, subtasks: string[]): string {
  return `---
id: ${id}
title: ${title}
status: todo
urgency: normal
categories: []
depends_on: []
draft: false
current_subtask: null
created: 2026-11-09
updated: 2026-11-09
---

## Spec
${body}

## Subtasks
${subtasks.map((t, i) => `- [ ] ${i + 1}. ${t}`).join('\n')}
`;
}

function writeSpec(root: string, id: string, slug: string, title: string, body: string, subtasks: string[]): void {
  const dir = path.join(root, '.specboard', 'specs', `${id}-${slug}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'spec.md'), specText(id, title, body, subtasks));
}

/** A temp git repo with a bare `origin`, after `init --yes`. `before` adds what the project already has before init. */
async function makeProject(name: string, addFiles: (root: string) => void, before?: (root: string) => void): Promise<ProjectEntry> {
  const root = path.join(tmp, name);
  fs.mkdirSync(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec Board Test');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  const origin = path.join(tmp, `${name}-origin.git`);
  git(tmp, 'init', '--bare', origin);
  git(root, 'remote', 'add', 'origin', origin);
  before?.(root);
  const { id } = await initCommand({ root, yes: true, forceSkills: false }, io);
  addFiles(root);
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'Baseline');
  return { id, name, root };
}

async function specOf(entry: ProjectEntry, id: string): Promise<Spec> {
  const spec = (await loadProject(entry.root)).specs.find((s) => s.id === id);
  if (!spec) throw new Error(`${id} not found`);
  return spec;
}

/** One real run to its end, with a `projectChanged` call per second standing in for the file watcher. */
async function run(entry: ProjectEntry, kind: RunKind, specId: string): Promise<{ snap: RunSnapshot; mine: RunEvent[] }> {
  const from = events.length;
  const started = await runs.start(entry, kind, specId);
  captures[captures.length - 1]!.label = `${entry.name} ${specId}`;
  const ended = await new Promise<RunSnapshot>((resolve) => {
    const timer = setInterval(() => {
      void runs.projectChanged(entry);
      const end = events.slice(from).find((e) => e.type === 'run-ended');
      if (end?.type === 'run-ended' && end.run.id === started.id) {
        clearInterval(timer);
        resolve(end.run);
      }
    }, 1000);
  });
  return { snap: ended, mine: events.slice(from) };
}

const reason = (s: RunSnapshot): string => JSON.stringify({ status: s.status, end: s.end, lines: s.lines.map((l) => `${l.k} ${l.text} ${l.code ?? ''}`) }, null, 1);
const fixRules = (fix: string | undefined): string[] => [...(fix ?? '').matchAll(/specboard allow "([^"]+)"/g)].map((m) => m[1]!);
const deniedNpm = (s: RunSnapshot): boolean => s.end?.denied?.some((d) => d.tool === 'Bash' && String((d.input as { command?: string }).command).includes('npm config get registry')) ?? false;

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** A process and everything under it, right now. */
function processTree(root: number): number[] {
  if (process.platform !== 'win32') return [root];
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress'], { encoding: 'utf8' });
  const all = JSON.parse(out) as { ProcessId: number; ParentProcessId: number }[];
  const tree = [root];
  for (let i = 0; i < tree.length; i++) {
    for (const p of all) if (p.ParentProcessId === tree[i] && !tree.includes(p.ProcessId)) tree.push(p.ProcessId);
  }
  return tree;
}

async function until(what: string, ok: () => boolean, ms = 120_000): Promise<void> {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const NPM_TASK = 'Run exactly the command `npm config get registry` with the Bash tool, and write what it prints to `registry.txt`. The command must really be run: its output cannot be guessed or worked out another way.';

describe.skipIf(!status?.loggedIn)('real claude runs', () => {
  let main: ProjectEntry;

  beforeAll(async () => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'specboard-real-')));
    process.env.SPECBOARD_HOME = path.join(tmp, 'home');
    events = [];
    runs = new RunManager({
      approved: approvedStore(),
      emit: (_pid, e) => events.push(e),
      roots: registeredRoots,
      command: (args) => {
        lastCapture = path.join(tmp, `capture-${++captureNo}.jsonl`);
        captures.push({ label: '', file: lastCapture });
        return { bin: process.execPath, args: [TEE, lastCapture, ...args] };
      },
    });
    main = await makeProject('fixture', (root) => {
      fs.writeFileSync(path.join(root, 'README.md'), '# Fixture\n');
      writeSpec(root, 'T-001', 'two-text-files', 'Two text files', 'Create two small text files in the project root. No tests are needed.', [
        'Create alpha.txt containing the word alpha',
        'Create beta.txt containing the word beta',
      ]);
      writeSpec(root, 'T-002', 'greeting', 'Greeting file', 'Create `greeting.txt` holding a greeting in the language the project owner prefers. Nothing in this project says which language that is, and it must not be guessed: ask.', [
        'Write greeting.txt in the language the owner prefers',
      ]);
      writeSpec(root, 'T-003', 'registry', 'Registry note', NPM_TASK, ['Save the npm registry address to registry.txt']);
      writeSpec(root, 'T-004', 'stop-me', 'Stop me', 'Create two small text files in the project root. No tests are needed.', [
        'Create one.txt containing the word one',
        'Create two.txt containing the word two',
      ]);
    });
  });

  afterAll(async () => {
    await runs.close();
    const rows = captures.map((c) => {
      let result: { total_cost_usd?: number; num_turns?: number; duration_ms?: number; modelUsage?: Record<string, unknown> } = {};
      try {
        for (const line of fs.readFileSync(c.file, 'utf8').split('\n')) if (line.includes('"type":"result"')) result = JSON.parse(line);
      } catch {
        // a stopped run has no result
      }
      return { run: c.label, usd: result.total_cost_usd ?? null, turns: result.num_turns ?? null, seconds: result.duration_ms ? Math.round(result.duration_ms / 1000) : null, models: Object.keys(result.modelUsage ?? {}).join(' ') };
    });
    console.log(`Usage per run (the CLI's own cost figure; a subscription doesn't bill it):\n${rows.map((r) => JSON.stringify(r)).join('\n')}\nTotal about $${rows.reduce((n, r) => n + (r.usd ?? 0), 0).toFixed(3)}`);
    if (process.env.SPECBOARD_REAL_KEEP) console.log(`Kept: ${tmp}`);
    else fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  });

  it('finishes a spec: Review, both boxes ticked, a log and a commit per subtask, nothing pushed', async () => {
    const before = git(main.root, 'rev-parse', 'HEAD');
    const { snap, mine } = await run(main, 'run', 'T-001');
    expect(snap.status, reason(snap)).toBe('finished');

    const spec = await specOf(main, 'T-001');
    expect(spec.status).toBe('review');
    expect(spec.currentSubtask).toBeNull();
    expect(spec.subtasks.every((t) => t.done)).toBe(true);

    const log = git(main.root, 'log', '--format=%h %s', `${before}..HEAD`).split('\n').reverse();
    expect(log.map((l) => l.replace(/^\S+ /, ''))).toEqual([
      'T-001 · 1. Create alpha.txt containing the word alpha',
      'T-001 · 2. Create beta.txt containing the word beta',
    ]);
    for (const n of [1, 2]) {
      const entry = spec.logs[n];
      expect(entry, `log for subtask ${n}`).toBeTruthy();
      expect(log[n - 1]!.startsWith(entry!.commit!), `log ${n} names commit ${entry!.commit}`).toBe(true);
    }
    expect(fs.readFileSync(path.join(main.root, 'alpha.txt'), 'utf8')).toMatch(/alpha/);
    expect(fs.readFileSync(path.join(main.root, 'beta.txt'), 'utf8')).toMatch(/beta/);

    // Streamed lines carry the subtask number the board's tick flash and toasts rely on.
    const ticks = mine.flatMap((e) => (e.type === 'run-line' && e.line.subtask !== undefined ? [e.line.subtask] : []));
    expect(ticks).toEqual([1, 2]);
    expect(mine.filter((e) => e.type === 'run-ended')).toHaveLength(1);

    expect(git(main.root, 'status', '--porcelain', '--', '.claude')).toBe('');
    expect(git(path.join(tmp, 'fixture-origin.git'), 'for-each-ref')).toBe('');

    // Ruling R8: bookkeeping stays uncommitted for the person to review, and all the code is committed.
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: main.root, encoding: 'utf8' });
    const dirty = status.split('\n').filter(Boolean).map((l) => l.slice(3));
    expect(dirty.every((f) => f.startsWith('.specboard/'))).toBe(true);
    console.log(`git status after T-001:\n${status}`);
  });

  it('stops for a decision: end state needs, with a new question the parser reads', async () => {
    const head = git(main.root, 'rev-parse', 'HEAD');
    const { snap } = await run(main, 'run', 'T-002');
    expect(snap.status, reason(snap)).toBe('needs');
    const spec = await specOf(main, 'T-002');
    expect(spec.status).toBe('doing');
    expect(spec.currentSubtask).toBeNull();
    expect(spec.problems).toEqual([]);
    expect(spec.questions.length).toBeGreaterThan(0);
    expect(spec.questions.every((q) => q.answer === null && q.text !== '')).toBe(true);
    expect(git(main.root, 'rev-parse', 'HEAD')).toBe(head);
    expect(fs.existsSync(path.join(main.root, 'greeting.txt'))).toBe(false);
  });

  it('is refused a command off the list: end state permission, and the offered fix gets past it', async () => {
    const { snap } = await run(main, 'run', 'T-003');
    expect(snap.status, reason(snap)).toBe('permission');
    expect(deniedNpm(snap)).toBe(true);
    const rules = fixRules(snap.end?.fix);
    expect(rules, reason(snap)).toEqual(['Bash(npm config:*)']);
    expect(fs.existsSync(path.join(main.root, 'registry.txt'))).toBe(false);

    await allowCommand({ rule: rules[0]!, root: main.root }, io);
    expect((await approvedStore().get(main.id, main.root))?.allow).toContain(rules[0]);

    // No question left behind: allowing the rule and pressing Run again has to be enough.
    expect((await specOf(main, 'T-003')).questions.filter((x) => x.answer === null)).toEqual([]);

    const again = await run(main, 'run', 'T-003');
    expect(again.snap.status, reason(again.snap)).toBe('finished');
    expect((await specOf(main, 'T-003')).status).toBe('review');
    expect(fs.readFileSync(path.join(main.root, 'registry.txt'), 'utf8')).toMatch(/http/);
  });

  it('stops mid-run: the whole process tree goes, one end event, and the spec is left clean', async () => {
    const from = events.length;
    const started = await runs.start(main, 'run', 'T-004');
    captures[captures.length - 1]!.label = `${main.name} T-004 (stopped)`;
    const pidFile = `${lastCapture}.pid`;
    await until('the first tool call', () => events.slice(from).some((e) => e.type === 'run-line' && ['read', 'edit', 'cmd'].includes(e.line.k)));
    const tree = processTree(Number(fs.readFileSync(pidFile, 'utf8')));
    expect(tree.length).toBeGreaterThan(1);

    await runs.stop(main.id, started.id);
    await until('the process tree to go', () => tree.every((p) => !alive(p)), 15_000);
    const ended = events.slice(from).filter((e) => e.type === 'run-ended');
    expect(ended).toHaveLength(1);
    expect(ended[0]!.type === 'run-ended' && ended[0]!.run.status).toBe('stopped');
    expect((await specOf(main, 'T-004')).currentSubtask).toBeNull();

    await new Promise((r) => setTimeout(r, 3000)); // a late `close` or timer must not end it twice
    expect(events.slice(from).filter((e) => e.type === 'run-ended')).toHaveLength(1);
  });

  it('ignores a hostile project: its hooks, MCP server and allow-all rule have no effect', async () => {
    const marker = (name: string) => `require('fs').writeFileSync('${name}','x')`;
    const hook = (name: string) => [{ matcher: '*', hooks: [{ type: 'command', command: `node -e "${marker(name)}"` }] }];
    const hostile = await makeProject('hostile', (root) => {
      writeSpec(root, 'T-001', 'registry', 'Registry note', NPM_TASK, ['Save the npm registry address to registry.txt']);
    }, (root) => {
      fs.mkdirSync(path.join(root, '.claude'));
      fs.writeFileSync(path.join(root, '.claude', 'settings.json'), JSON.stringify({
        permissions: { allow: ['Bash(*)'] },
        hooks: { PreToolUse: hook('pre-marker.txt'), SessionStart: hook('session-marker.txt') },
      }, null, 2));
      fs.writeFileSync(path.join(root, '.mcp.json'), JSON.stringify({ mcpServers: { ghost: { command: 'node', args: ['-e', marker('mcp-marker.txt')] } } }, null, 2));
    });

    // The marker command does work, so a missing marker means it did not run.
    execFileSync('node', ['-e', marker('control-marker.txt')], { cwd: hostile.root });
    expect(fs.existsSync(path.join(hostile.root, 'control-marker.txt'))).toBe(true);
    fs.rmSync(path.join(hostile.root, 'control-marker.txt'));
    expect((await approvedStore().get(hostile.id, hostile.root))?.allow).not.toContain('Bash(*)');

    const { snap } = await run(hostile, 'run', 'T-001');
    for (const m of ['pre-marker.txt', 'session-marker.txt', 'mcp-marker.txt']) {
      expect(fs.existsSync(path.join(hostile.root, m)), m).toBe(false);
    }
    expect(snap.status, reason(snap)).toBe('permission');
    expect(deniedNpm(snap)).toBe(true);
    expect(fs.existsSync(path.join(hostile.root, 'registry.txt'))).toBe(false);
  });
});
