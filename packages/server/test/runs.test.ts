import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadProject } from '@specboard/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovedPermissions, type Permissions } from '../src/setup.js';
import { kitPluginDir } from '../src/kit.js';
import { projectId, type ProjectEntry } from '../src/registry.js';
import {
  buildRunArgs,
  clearCurrentSubtask,
  ClaudeUnavailableError,
  NotApprovedError,
  RunBusyError,
  runPrompt,
  RunManager,
  type RunEvent,
  type RunSnapshot,
} from '../src/claude/runs.js';
import { childEnv, makeClaudeStatus, type ClaudeStatus } from '../src/claude/status.js';

// These tests start real processes, which is slow on Windows: longer than any wait inside them, well over vitest's 5 s default.
vi.setConfig({ testTimeout: 40000 });

const FAKE = path.resolve(import.meta.dirname, 'fixtures', 'fake-claude.mjs');
const APPROVED: Permissions = { allow: ['Read(./**)', 'Edit(./**)', 'Write(./**)', 'Bash(git status:*)'], deny: ['Bash(git push:*)', 'Edit(./.claude/**)'] };
const OK_STATUS: ClaudeStatus = { installed: true, loggedIn: true, version: '2.1.302' };

const SPEC = `---
id: T-001
title: Demo
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
A demo.

## Subtasks
- [ ] 1. First
- [ ] 2. Second
`;

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

let tmp: string;
let approved: ApprovedPermissions;
let events: { pid: string; e: RunEvent }[];
let managers: RunManager[];
let recordCount: number;
let leftoverPids: number[];

async function makeProject(name = 'proj', approve = true): Promise<ProjectEntry> {
  const root = path.join(tmp, name);
  const dir = path.join(root, '.specboard', 'specs', 'T-001-demo');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'spec.md'), SPEC);
  await fs.mkdir(path.join(root, '.claude'));
  await fs.writeFile(path.join(root, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(curl:*)'], deny: [] } }));
  const entry = { id: projectId(root), name, root };
  if (approve) await approved.set(entry.id, root, APPROVED);
  return entry;
}

function manager(scenario: string, opts: { status?: () => Promise<ClaudeStatus>; bin?: string } = {}) {
  const spawned: string[][] = [];
  const records: string[] = [];
  const m = new RunManager({
    approved,
    emit: (pid, e) => events.push({ pid, e }),
    status: opts.status ?? (async () => OK_STATUS),
    command: (args) => {
      spawned.push(args);
      const record = path.join(tmp, `record-${++recordCount}.json`);
      records.push(record);
      if (opts.bin) return { bin: opts.bin, args };
      return { bin: process.execPath, args: [FAKE, scenario, record, ...args] };
    },
  });
  managers.push(m);
  return { m, spawned, records };
}

const specFile = (e: ProjectEntry) => path.join(e.root, '.specboard', 'specs', 'T-001-demo', 'spec.md');
const loadSpec = async (e: ProjectEntry) => (await loadProject(e.root)).specs.find((s) => s.id === 'T-001')!;

async function ended(runId: string, timeout = 15000): Promise<RunSnapshot> {
  return vi.waitFor(
    () => {
      const hit = events.find((x) => x.e.type === 'run-ended' && x.e.run.id === runId);
      if (!hit || hit.e.type !== 'run-ended') throw new Error('not ended');
      return hit.e.run;
    },
    { timeout, interval: 20 },
  );
}

const waitForFile = (file: string) => vi.waitFor(() => fs.access(file), { timeout: 10000, interval: 20 });

/** Waits until the fake's grandchild is beating and returns its pid. */
async function heartbeat(record: string): Promise<number> {
  await waitForFile(`${record}.pid`);
  await waitForFile(`${record}.heartbeat`);
  const pid = Number(await fs.readFile(`${record}.pid`, 'utf8'));
  leftoverPids.push(pid);
  return pid;
}

async function expectHeartbeatStopped(record: string, pid: number): Promise<void> {
  await vi.waitFor(() => expect(alive(pid)).toBe(false), { timeout: 5000, interval: 50 });
  const file = `${record}.heartbeat`;
  const a = await fs.readFile(file, 'utf8');
  await new Promise((r) => setTimeout(r, 300));
  expect(await fs.readFile(file, 'utf8')).toBe(a);
}

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-runs-')));
  approved = new ApprovedPermissions(path.join(tmp, 'permissions.json'));
  events = [];
  managers = [];
  recordCount = 0;
  leftoverPids = [];
});

afterEach(async () => {
  await Promise.all(managers.map((m) => m.close()));
  for (const pid of leftoverPids) if (alive(pid)) process.kill(pid);
  await fs.rm(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
});

describe('buildRunArgs', () => {
  it('is exactly the isolated command line', () => {
    expect(buildRunArgs('/specboard:run-spec T-001', APPROVED, 'C:/kit')).toEqual([
      '-p', '/specboard:run-spec T-001',
      '--output-format', 'stream-json',
      '--verbose',
      '--permission-mode', 'dontAsk',
      '--setting-sources', '',
      '--plugin-dir', 'C:/kit',
      '--settings', JSON.stringify({ permissions: { allow: APPROVED.allow, deny: APPROVED.deny }, disableAllHooks: true }),
    ]);
  });

  it('carries nothing but the two approved lists', () => {
    const args = buildRunArgs('p', { ...APPROVED, extra: 1 } as Permissions, 'k');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(Object.keys(JSON.parse(args.at(-1)!).permissions)).toEqual(['allow', 'deny']);
  });
});

describe('runPrompt', () => {
  it('is fixed by kind', () => {
    expect(runPrompt('run', 'T-001')).toBe('/specboard:run-spec T-001');
    expect(runPrompt('write-up', 'T-001')).toBe('/specboard:create-spec T-001');
    expect(runPrompt('fix-file', 'T-001')).toBe("/specboard:update-spec T-001 Fix this file's formatting problems. Keep all content.");
    expect(runPrompt('refresh-overview', null)).toBe('/specboard:refresh-overview');
  });

  it('refuses a bad ID, a missing one, and an ID where none belongs', () => {
    for (const id of ['T-1', 'T-001 && rm', 'T-001\n', 'x', '', null]) expect(() => runPrompt('run', id)).toThrow(/spec ID/i);
    expect(() => runPrompt('refresh-overview', 'T-001')).toThrow(/spec ID/i);
  });
});

describe('childEnv', () => {
  it('removes the session variables and keeps the rest', () => {
    const strip = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_EFFORT', 'CLAUDE_PID', 'CLAUDE_AGENT_SDK_MCP_NO_PREFIX'];
    const keep = [
      'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_OAUTH_REFRESH_TOKEN', 'CLAUDE_CODE_OAUTH_SCOPES',
      'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_USE_MANTLE', 'CLAUDE_CODE_USE_ANTHROPIC_AWS',
      'CLAUDE_CODE_SKIP_BEDROCK_AUTH', 'CLAUDE_CODE_SKIP_VERTEX_AUTH', 'CLAUDE_CODE_SKIP_FOUNDRY_AUTH', 'CLAUDE_CODE_SKIP_MANTLE_AUTH', 'CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH',
      'CLAUDE_CODE_CLIENT_CERT', 'CLAUDE_CODE_CLIENT_KEY', 'CLAUDE_CODE_CLIENT_KEY_PASSPHRASE', 'CLAUDE_CODE_GIT_BASH_PATH',
      'CLAUDE_CONFIG_DIR', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'SPECBOARD_TEST_VAR',
    ];
    for (const k of [...strip, ...keep]) vi.stubEnv(k, 'stub');
    try {
      const env = childEnv([]);
      for (const k of strip) expect(env[k], k).toBeUndefined();
      for (const k of keep) expect(env[k], k).toBe('stub');
      expect(env.PATH ?? env.Path).toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('a run that succeeds', () => {
  it('goes running to finished, in order, with the spec in Review', async () => {
    const entry = await makeProject();
    const { m, records } = manager('success');
    const started = await m.start(entry, 'run', 'T-001');
    expect(started.status).toBe('running');
    expect(started.specId).toBe('T-001');
    expect(started.lines[0]).toMatchObject({ k: 'start', text: 'Started on T-001 · Demo', seq: 1 });
    expect(started.lines[0]!.time).toMatch(/^\d{2}:\d{2}$/);

    const run = await ended(started.id);
    expect(run.status).toBe('finished');
    expect(m.current(entry.id)).toMatchObject({ id: started.id, status: 'finished', dismissed: false });
    expect((await loadSpec(entry)).status).toBe('review');

    const seqs = run.lines.map((l) => l.seq);
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
    expect(run.lines.some((l) => l.k === 'read' && l.code === 'notes.txt')).toBe(true); // relative to the project root
    expect(run.lines.slice(-3).map((l) => [l.k, l.text, l.code])).toEqual([
      ['done', 'Subtask 1 done: First · committed', 'aaa1111'],
      ['done', 'Subtask 2 done: Second · committed', 'bbb2222'],
      ['done', 'All subtasks done · committed', 'bbb2222'],
    ]);
    // Only the per-subtask lines are marked, not the closing `done` line or anything else.
    expect(run.lines.flatMap((l) => (l.subtask === undefined ? [] : [[l.subtask, l.text]]))).toEqual([
      [1, 'Subtask 1 done: First · committed'],
      [2, 'Subtask 2 done: Second · committed'],
    ]);

    const types = events.map((x) => x.e.type);
    expect(types[0]).toBe('run-started');
    expect(types.at(-1)).toBe('run-ended');
    expect(types.filter((t) => t === 'run-ended')).toHaveLength(1);
    const streamed = events.flatMap((x) => (x.e.type === 'run-line' ? [x.e.line.seq] : []));
    expect(streamed).toEqual(run.lines.slice(1).map((l) => l.seq));

    const record = JSON.parse(await fs.readFile(records[0]!, 'utf8')) as { cwd: string };
    expect(path.resolve(record.cwd).toLowerCase()).toBe(entry.root.toLowerCase());
  });

  it('passes the approved rules, not the project settings, and the kit as the plugin', async () => {
    const entry = await makeProject();
    const { m, records } = manager('plain');
    const run = await m.start(entry, 'write-up', 'T-001');
    await ended(run.id);
    const { args } = JSON.parse(await fs.readFile(records[0]!, 'utf8')) as { args: string[] };
    expect(args).toEqual(buildRunArgs('/specboard:create-spec T-001', APPROVED, kitPluginDir()));
    expect(args.join(' ')).not.toContain('curl');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
  });

  it('gives the child the cleaned environment', async () => {
    vi.stubEnv('CLAUDECODE', '1');
    vi.stubEnv('CLAUDE_CODE_SESSION_ACCESS', 'x');
    vi.stubEnv('SPECBOARD_TEST_VAR', 'yes');
    try {
      const entry = await makeProject();
      const { m, records } = manager('plain');
      await ended((await m.start(entry, 'write-up', 'T-001')).id);
      const { env } = JSON.parse(await fs.readFile(records[0]!, 'utf8')) as { env: Record<string, string> };
      expect(env.CLAUDECODE).toBeUndefined();
      expect(env.CLAUDE_CODE_SESSION_ACCESS).toBeUndefined();
      expect(env.SPECBOARD_TEST_VAR).toBe('yes');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('uses plain wording for each kind', async () => {
    const entry = await makeProject();
    const { m } = manager('plain');
    const overview = await m.start(entry, 'refresh-overview', null);
    expect(overview.lines[0]!.text).toBe('Started refreshing the overview');
    const a = await ended(overview.id);
    expect(a.status).toBe('finished');
    expect(a.lines.at(-1)).toMatchObject({ k: 'done', text: 'Overview refreshed' });

    const writeUp = await m.start(entry, 'write-up', 'T-001');
    expect(writeUp.lines[0]!.text).toBe('Started on T-001 · Demo');
    expect((await ended(writeUp.id)).lines.at(-1)).toMatchObject({ k: 'done', text: 'Spec written up' });

    const fix = await m.start(entry, 'fix-file', 'T-001');
    expect((await ended(fix.id)).lines.at(-1)).toMatchObject({ k: 'done', text: 'File fixed' });
  });
});

describe('who may start', () => {
  it('a second start throws RunBusyError with the running run; another project still starts', async () => {
    const entry = await makeProject();
    const other = await makeProject('other');
    const { m } = manager('idle');
    const run = await m.start(entry, 'run', 'T-001');
    const err = await m.start(entry, 'run', 'T-001').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RunBusyError);
    expect((err as RunBusyError).run.id).toBe(run.id);
    const second = await m.start(other, 'run', 'T-001');
    expect(second.pid).toBe(other.id);
  });

  it('two starts at the same moment spawn once', async () => {
    const entry = await makeProject();
    const { m, spawned } = manager('idle');
    const results = await Promise.allSettled([m.start(entry, 'run', 'T-001'), m.start(entry, 'run', 'T-001')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(RunBusyError);
    expect(spawned).toHaveLength(1);
  });

  it('no approved list, or one for another folder, is NotApprovedError and spawns nothing', async () => {
    const entry = await makeProject('proj', false);
    const { m, spawned } = manager('plain');
    await expect(m.start(entry, 'run', 'T-001')).rejects.toBeInstanceOf(NotApprovedError);

    const moved = await makeProject('moved', false);
    await approved.set(entry.id, moved.root, APPROVED);
    await expect(m.start(entry, 'run', 'T-001')).rejects.toBeInstanceOf(NotApprovedError);
    expect(spawned).toEqual([]);
    expect(m.current(entry.id)).toBeNull();
  });

  it('a missing or logged-out Claude is ClaudeUnavailableError, spawns nothing and leaves the project free', async () => {
    const entry = await makeProject();
    let status: ClaudeStatus = { installed: false, loggedIn: false, version: null };
    const { m, spawned } = manager('plain', { status: async () => status });
    const a = await m.start(entry, 'run', 'T-001').catch((e: unknown) => e);
    expect(a).toBeInstanceOf(ClaudeUnavailableError);
    expect((a as ClaudeUnavailableError).reason).toBe('not-installed');

    status = { installed: true, loggedIn: false, version: '1' };
    const b = await m.start(entry, 'run', 'T-001').catch((e: unknown) => e);
    expect((b as ClaudeUnavailableError).reason).toBe('logged-out');
    expect(spawned).toEqual([]);

    status = OK_STATUS;
    await ended((await m.start(entry, 'run', 'T-001')).id);
    expect(spawned).toHaveLength(1);
  });

  it('a bad ID or an unknown spec is refused without spawning and leaves the project free', async () => {
    const entry = await makeProject();
    const { m, spawned } = manager('plain');
    await expect(m.start(entry, 'run', 'T-001; calc')).rejects.toThrow(/spec ID/i);
    await expect(m.start(entry, 'run', 'T-999')).rejects.toThrow(/T-999/);
    expect(spawned).toEqual([]);
    await ended((await m.start(entry, 'run', 'T-001')).id);
  });

  it('refuses to start after close', async () => {
    const entry = await makeProject();
    const { m, spawned } = manager('plain');
    await m.close();
    await expect(m.start(entry, 'run', 'T-001')).rejects.toThrow();
    expect(spawned).toEqual([]);
  });

  it('close during a start stops it before anything spawns', async () => {
    const entry = await makeProject();
    let release: ((s: ClaudeStatus) => void) | undefined;
    const { m, spawned } = manager('idle', { status: () => new Promise((r) => (release = r)) });
    const starting = m.start(entry, 'run', 'T-001');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const closing = m.close();
    release!(OK_STATUS);
    const run = await starting;
    await closing;
    expect(spawned).toEqual([]);
    expect(m.current(entry.id)).toMatchObject({ id: run.id, status: 'stopped' });
  });
});

describe('stored rules that fail the checks', () => {
  const editStored = async (e: ProjectEntry, change: (p: { allow: string[]; deny: string[] }) => void) => {
    const file = path.join(tmp, 'permissions.json');
    const all = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, { allow: string[]; deny: string[] }>;
    change(all[e.id]!);
    await fs.writeFile(file, JSON.stringify(all));
  };

  it.each([
    ['a rule that would run a command through a shim', (p: { allow: string[] }) => p.allow.push('Read(./x&echo pwned>marker.txt&/**)')],
    ['a hand-edited Bash(*)', (p: { allow: string[] }) => p.allow.push('Bash(*)')],
    ['an allow rule that meets the deny list', (p: { allow: string[] }) => p.allow.push('Bash(git push origin:*)')],
    ['a metacharacter in a deny rule', (p: { deny: string[] }) => p.deny.push('Read(./x&echo pwned>marker.txt&/**)')],
  ])('%s is NotApprovedError, spawns nothing and names init', async (_name, change) => {
    const entry = await makeProject();
    await editStored(entry, change as (p: { allow: string[]; deny: string[] }) => void);
    const { m, spawned } = manager('plain');
    const err = await m.start(entry, 'run', 'T-001').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotApprovedError);
    expect((err as Error).message).toMatch(/specboard init/);
    expect(spawned).toEqual([]);
    expect(events).toEqual([]);
    await expect(fs.access(path.join(entry.root, 'marker.txt'))).rejects.toThrow();
  });
});

describe.runIf(process.platform === 'win32')('through a .cmd shim, as an npm-global install runs', () => {
  it.each([
    ['fix-file', 'T-001'],
    ['refresh-overview', null],
  ] as const)('%s: the child gets exactly the arguments sent, real quotes and the empty one included', async (kind, specId) => {
    const dir = path.join(tmp, 'shim dir');
    await fs.mkdir(dir);
    const out = path.join(dir, 'argv.json');
    await fs.writeFile(
      path.join(dir, 'echo.cjs'),
      `require('fs').writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)));
console.log(JSON.stringify({ type: 'result', is_error: false, result: 'done', permission_denials: [] }));`,
    );
    const shim = path.join(dir, 'claude.cmd');
    await fs.writeFile(shim, `@"${process.execPath}" "%~dp0echo.cjs" %*\r\n`);

    const entry = await makeProject();
    const perms: Permissions = {
      allow: ['Read(./**)', 'Read(./app/(group)/**)', 'Edit(./**)', 'Bash(npm run test:*)', 'WebFetch(domain:example.com)'],
      deny: ['Bash(git push:*)', 'Bash(rm -rf:*)', 'Edit(./.claude/**)'],
    };
    await approved.set(entry.id, entry.root, perms);
    const { m } = manager('plain', { bin: shim });
    const run = await ended((await m.start(entry, kind, specId)).id);
    expect(run.status).toBe('finished');

    const argv = JSON.parse(await fs.readFile(out, 'utf8')) as string[];
    expect(argv).toEqual(buildRunArgs(runPrompt(kind, specId), perms, kitPluginDir()));
    expect(argv[argv.indexOf('--setting-sources') + 1]).toBe('');
    expect(JSON.parse(argv.at(-1)!)).toEqual({ permissions: perms, disableAllHooks: true });
  });
});

describe('a run with no child', () => {
  const STALE = SPEC.replace('current_subtask: null', 'current_subtask: 2').replace('- [ ] 1. First', '- [x] 1. First');
  const types = () => events.map((x) => x.e.type);

  it('a spawn failure is announced and ended, and leaves the spec alone', async () => {
    const entry = await makeProject();
    await fs.writeFile(specFile(entry), STALE);
    const { m } = manager('plain', { bin: 'specboard-no-such-program' });
    const started = await m.start(entry, 'run', 'T-001');
    const run = await ended(started.id);
    expect(run.status).toBe('error');
    expect(types()[0]).toBe('run-started');
    expect(types().at(-1)).toBe('run-ended');
    expect(run.lines.map((l) => l.k)).toEqual(['start', 'err']);
    expect(await fs.readFile(specFile(entry), 'utf8')).toBe(STALE);
  });

  it('close during a start leaves the spec alone', async () => {
    const entry = await makeProject();
    await fs.writeFile(specFile(entry), STALE);
    let release: ((s: ClaudeStatus) => void) | undefined;
    const { m } = manager('idle', { status: () => new Promise((r) => (release = r)) });
    const starting = m.start(entry, 'run', 'T-001');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const closing = m.close();
    release!(OK_STATUS);
    const run = await starting;
    await closing;
    expect(types()).toEqual(['run-started', 'run-line', 'run-ended']);
    expect(m.current(entry.id)).toMatchObject({ id: run.id, status: 'stopped' });
    expect(m.current(entry.id)!.lines.map((l) => l.k)).toEqual(['start', 'stop']);
    expect(await fs.readFile(specFile(entry), 'utf8')).toBe(STALE);
  });

  it('a preparation that outlasts the stop timer emits nothing, spawns nothing and frees the project', async () => {
    const entry = await makeProject();
    await fs.writeFile(specFile(entry), STALE);
    let release: ((s: ClaudeStatus) => void) | undefined;
    let answer: () => Promise<ClaudeStatus> = () => new Promise((r) => (release = r));
    const { m, spawned } = manager('idle', { status: () => answer() });
    const starting = m.start(entry, 'run', 'T-001');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const busy = await m.start(entry, 'run', 'T-001').catch((e: unknown) => e);
    await m.stop(entry.id, (busy as RunBusyError).run.id); // resolves when the stop timer gives up
    expect(events).toEqual([]);
    expect(m.current(entry.id)).toBeNull();

    release!(OK_STATUS);
    expect((await starting).status).toBe('stopped');
    expect(events).toEqual([]);
    expect(spawned).toEqual([]);
    expect(await fs.readFile(specFile(entry), 'utf8')).toBe(STALE);

    answer = async () => OK_STATUS;
    await m.start(entry, 'run', 'T-001'); // the project is free
    expect(spawned).toHaveLength(1);
  });
});

describe('clearCurrentSubtask', () => {
  it('clears only the value seen at the end of the run, never a newer edit', async () => {
    const entry = await makeProject();
    const with3 = SPEC.replace('current_subtask: null', 'current_subtask: 3');
    await fs.writeFile(specFile(entry), with3);
    await clearCurrentSubtask(specFile(entry), 2);
    expect(await fs.readFile(specFile(entry), 'utf8')).toBe(with3);
    await clearCurrentSubtask(specFile(entry), 3);
    expect(await fs.readFile(specFile(entry), 'utf8')).toBe(SPEC);
  });
});

describe('stopping', () => {
  it('ends the child and its grandchild; the heartbeat stops', async () => {
    const entry = await makeProject();
    const { m, records } = manager('hang');
    const run = await m.start(entry, 'run', 'T-001');
    const pid = await heartbeat(records[0]!);
    expect(alive(pid)).toBe(true);

    await m.stop(entry.id, run.id);
    const snap = m.current(entry.id)!;
    expect(snap.status).toBe('stopped');
    expect(snap.end).toEqual({ status: 'stopped' });
    expect(snap.lines.at(-1)).toMatchObject({ k: 'stop', text: 'Stopped by you' });
    await expectHeartbeatStopped(records[0]!, pid);
  });

  it('a hung child still stops, a double stop is harmless, and a stop after the end does nothing', async () => {
    const entry = await makeProject();
    const { m } = manager('idle');
    const run = await m.start(entry, 'run', 'T-001');
    await Promise.all([m.stop(entry.id, run.id), m.stop(entry.id, run.id)]);
    await m.stop(entry.id, run.id);
    expect(m.current(entry.id)!.status).toBe('stopped');
    expect(events.filter((x) => x.e.type === 'run-ended')).toHaveLength(1);
    expect(m.current(entry.id)!.lines.filter((l) => l.k === 'stop')).toHaveLength(1);
  });

  it('a stop for another run ID does nothing', async () => {
    const entry = await makeProject();
    const { m } = manager('idle');
    await m.start(entry, 'run', 'T-001');
    await m.stop(entry.id, 'not-this-run');
    expect(m.current(entry.id)!.status).toBe('running');
  });

  it('becomes stopped even when something outside the tree keeps the pipe open', async () => {
    const entry = await makeProject();
    const { m, records } = manager('lagging-close');
    const run = await m.start(entry, 'run', 'T-001');
    const pid = await heartbeat(records[0]!);
    const at = Date.now();
    await m.stop(entry.id, run.id);
    expect(Date.now() - at).toBeLessThan(9000);
    expect(alive(pid)).toBe(true); // proves the pipe really was still held
    expect(m.current(entry.id)!.status).toBe('stopped');
    expect(m.current(entry.id)!.lines.at(-1)!.k).toBe('stop');
  });

  it('close kills a running child and its grandchild', async () => {
    const entry = await makeProject();
    const { m, records } = manager('hang');
    await m.start(entry, 'run', 'T-001');
    const pid = await heartbeat(records[0]!);
    await m.close();
    expect(m.current(entry.id)!.status).toBe('stopped');
    await expectHeartbeatStopped(records[0]!, pid);
  });
});

describe('how a run ends', () => {
  it('a crash with no result is an error with the exit code', async () => {
    const entry = await makeProject();
    const { m } = manager('crash');
    const run = await ended((await m.start(entry, 'run', 'T-001')).id);
    expect(run.status).toBe('error');
    expect(run.end).toMatchObject({ status: 'error', title: 'Claude Code exited with code 3', text: 'boom: the last line' });
    expect(run.lines.at(-1)).toMatchObject({ k: 'err', text: 'Claude Code exited with code 3' });
  });

  it('a program that cannot be spawned is an error end, not an exception or a stuck run', async () => {
    const entry = await makeProject();
    const { m } = manager('plain', { bin: 'specboard-no-such-program' });
    const run = await ended((await m.start(entry, 'run', 'T-001')).id);
    expect(run.status).toBe('error');
    expect(run.end!.title).toBe("Couldn't start Claude Code");
    expect(run.end!.text).toMatch(/ENOENT/);
    expect(run.lines.at(-1)).toMatchObject({ k: 'err', text: "Couldn't start Claude Code" });
    await expect(m.start(entry, 'run', 'T-001')).resolves.toBeTruthy(); // the project is free again
  });

  it('a process that exits while a grandchild holds the pipe still ends', async () => {
    const entry = await makeProject();
    const { m, records } = manager('orphan-exit');
    const run = await m.start(entry, 'write-up', 'T-001');
    const pid = await heartbeat(records[0]!);
    const snap = await ended(run.id);
    expect(alive(pid)).toBe(true);
    expect(snap.status).toBe('finished');
  });

  it('a denied action the deny list blocks offers no fix; an ordinary one does', async () => {
    const entry = await makeProject();
    const a = manager('denied-push');
    const blocked = await ended((await a.m.start(entry, 'run', 'T-001')).id);
    expect(blocked.status).toBe('permission');
    expect(blocked.end!.fix).toBeUndefined();
    expect(blocked.lines.at(-1)).toMatchObject({ k: 'err', text: 'Not allowed:', code: 'git push origin HEAD' });

    const b = manager('denied-npm');
    const fixable = await ended((await b.m.start(entry, 'run', 'T-001')).id);
    expect(fixable.end!.fix).toBe('specboard allow "Bash(npm install:*)"');
  });

  it('a new open question ends in needs', async () => {
    const entry = await makeProject();
    const { m } = manager('question');
    const run = await ended((await m.start(entry, 'run', 'T-001')).id);
    expect(run.status).toBe('needs');
    expect(run.lines.at(-1)).toMatchObject({ k: 'warn', text: 'Paused: Claude added an open question' });
  });

  it('clears a leftover current_subtask and leaves the rest of the file alone', async () => {
    const entry = await makeProject();
    const { m } = manager('leftover');
    await ended((await m.start(entry, 'write-up', 'T-001')).id);
    expect((await loadSpec(entry)).currentSubtask).toBeNull();
    expect(await fs.readFile(specFile(entry), 'utf8')).toBe(SPEC);
  });
});

describe('run lines', () => {
  it('adds exactly one line per newly ticked subtask, with the commit from its log', async () => {
    const entry = await makeProject();
    const { m } = manager('idle');
    const run = await m.start(entry, 'run', 'T-001');

    await fs.writeFile(specFile(entry), SPEC.replace('- [ ] 1. First', '- [x] 1. First'));
    const logs = path.join(path.dirname(specFile(entry)), 'logs');
    await fs.mkdir(logs);
    await fs.writeFile(path.join(logs, '1-first.md'), '---\nsubtask: 1\ncommit: abc1234\nfiles: [a.txt]\n---\n');
    await Promise.all([m.projectChanged(entry), m.projectChanged(entry)]);
    await m.projectChanged(entry);

    const done = () => m.current(entry.id)!.lines.filter((l) => l.k === 'done');
    expect(done().map((l) => [l.text, l.code])).toEqual([['Subtask 1 done: First · committed', 'abc1234']]);

    await m.stop(entry.id, run.id);
    expect(done()).toHaveLength(1);
    await m.projectChanged(entry); // no run going: nothing happens
    expect(done()).toHaveLength(1);
  });

  it('does not claim a commit when the log has none', async () => {
    const entry = await makeProject();
    const { m } = manager('idle');
    await m.start(entry, 'run', 'T-001');
    await fs.writeFile(specFile(entry), SPEC.replace('- [ ] 1. First', '- [x] 1. First'));
    await m.projectChanged(entry);
    const line = m.current(entry.id)!.lines.find((l) => l.k === 'done')!;
    expect(line.text).toBe('Subtask 1 done: First');
    expect(line.subtask).toBe(1);
    expect(line.code).toBeUndefined();
  });

  it('keeps the newest 2000 lines while seq keeps counting', async () => {
    const entry = await makeProject();
    const { m } = manager('flood');
    const run = await ended((await m.start(entry, 'write-up', 'T-001')).id);
    expect(run.lines).toHaveLength(2000);
    expect(run.lines.at(-1)!.seq).toBe(2102); // start + 2100 + final
    expect(run.lines[0]!.seq).toBe(103);
  });
});

describe('the last run', () => {
  it('stays until dismissed or replaced', async () => {
    const entry = await makeProject();
    const { m } = manager('plain');
    const first = await ended((await m.start(entry, 'write-up', 'T-001')).id);
    m.dismiss(entry.id, 'other');
    expect(m.current(entry.id)!.dismissed).toBe(false);
    m.dismiss(entry.id, first.id);
    expect(m.current(entry.id)).toMatchObject({ id: first.id, dismissed: true });
    const second = await ended((await m.start(entry, 'write-up', 'T-001')).id);
    expect(m.current(entry.id)).toMatchObject({ id: second.id, dismissed: false });
  });

  it('snapshots are copies', async () => {
    const entry = await makeProject();
    const { m } = manager('plain');
    const run = await ended((await m.start(entry, 'write-up', 'T-001')).id);
    run.lines.length = 0;
    expect(m.current(entry.id)!.lines.length).toBeGreaterThan(0);
  });
});

describe('claudeStatus', () => {
  type Out = { code: number | null; stdout: string };
  const runner = (auth: Out | Error, version: Out | Error = { code: 0, stdout: '2.1.302 (Claude Code)\n' }) =>
    vi.fn(async (args: string[]) => {
      const r = args[0] === '--version' ? version : auth;
      if (r instanceof Error) throw r;
      return r;
    });

  it('reports version and login', async () => {
    const status = makeClaudeStatus(runner({ code: 0, stdout: '{"loggedIn":true}' }));
    expect(await status()).toEqual({ installed: true, loggedIn: true, version: '2.1.302' });
  });

  it('logged out, by the JSON or by the exit code', async () => {
    expect(await makeClaudeStatus(runner({ code: 0, stdout: '{"loggedIn":false}' }))()).toMatchObject({ installed: true, loggedIn: false });
    expect(await makeClaudeStatus(runner({ code: 1, stdout: '' }))()).toMatchObject({ installed: true, loggedIn: false });
  });

  it('never throws, and a failed --version means not installed', async () => {
    const down = { installed: false, loggedIn: false, version: null };
    expect(await makeClaudeStatus(runner(new Error('x'), new Error('ENOENT')))()).toEqual(down);
    expect(await makeClaudeStatus(runner({ code: 0, stdout: '' }, { code: 1, stdout: '' }))()).toEqual(down);
    expect(await makeClaudeStatus(runner(new Error('auth broke')))()).toEqual({ installed: true, loggedIn: false, version: '2.1.302' });
  });

  it('caches for 30 s and shares a call in flight', async () => {
    let t = 1000;
    const run = runner({ code: 0, stdout: '{"loggedIn":true}' });
    const status = makeClaudeStatus(run, () => t);
    await Promise.all([status(), status()]);
    expect(run).toHaveBeenCalledTimes(2);
    t += 29_000;
    await status();
    expect(run).toHaveBeenCalledTimes(2);
    t += 2_000;
    await status();
    expect(run).toHaveBeenCalledTimes(4);
  });
});

describe('claudeStatus after a negative answer', () => {
  const up = '{"loggedIn":true}';
  const down = '{"loggedIn":false}';

  it('a Run re-checks once: a login inside the 30 s cache is not refused', async () => {
    let auth = down;
    const run = vi.fn(async (args: string[]) => ({ code: 0, stdout: args[0] === '--version' ? '2.1.302\n' : auth }));
    const status = makeClaudeStatus(run, () => 1000);
    expect((await status()).loggedIn).toBe(false);
    auth = up;
    expect((await status()).loggedIn).toBe(false); // a plain read keeps the cache
    expect(run).toHaveBeenCalledTimes(2);
    expect((await status({ recheckIfDown: true })).loggedIn).toBe(true);
    expect(run).toHaveBeenCalledTimes(4);
    expect((await status()).loggedIn).toBe(true); // and the better answer is what is remembered
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('does not re-check a positive answer, or one it has only just fetched', async () => {
    const good = vi.fn(async (args: string[]) => ({ code: 0, stdout: args[0] === '--version' ? '2.1.302\n' : up }));
    const a = makeClaudeStatus(good, () => 1000);
    await a();
    await a({ recheckIfDown: true });
    expect(good).toHaveBeenCalledTimes(2);
    const bad = vi.fn(async (args: string[]) => ({ code: 0, stdout: args[0] === '--version' ? '2.1.302\n' : down }));
    const b = makeClaudeStatus(bad, () => 1000);
    expect((await b({ recheckIfDown: true })).loggedIn).toBe(false);
    expect(bad).toHaveBeenCalledTimes(2);
  });

  it('a manager asks for that re-check when it starts a run', async () => {
    const entry = await makeProject();
    const status = vi.fn(async () => OK_STATUS);
    const { m } = manager('success', { status });
    const started = await m.start(entry, 'run', 'T-001');
    await ended(started.id);
    expect(status).toHaveBeenCalledWith({ recheckIfDown: true });
  });
});
