import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { hashText, loadProject, parseSpec, setMetaField, writeIfUnchanged, youStep, type Spec } from '@specboard/core';
import spawn from 'cross-spawn';
import { kitPluginDir } from '../kit.js';
import type { ProjectEntry } from '../registry.js';
import { InvalidApprovalError, type ApprovedPermissions, type Permissions } from '../setup.js';
import { classifyEnd, type EndInfo, type RunKind, type RunStatus } from './classify.js';
import { archiveIds, archiveProposed, deleteProposal, parseProposal, proposalApplied, readProposalText } from '../syncProposal.js';
import { LogTokenTally } from './logTokens.js';
import { LineSplitter, parseEvent, type ClaudeResult, type ParsedLine, type RunLine } from './events.js';
import { killTree, resolveFromEnv } from './resolve.js';
import { childEnv, claudeStatus, type ClaudeStatus, type ClaudeStatusCheck, type ProjectRoots } from './status.js';

export interface RunSnapshot { id: string; pid: string; kind: RunKind; specId: string | null; status: RunStatus; lines: RunLine[]; end: EndInfo | null; startedAt: string; dismissed: boolean }
export type RunEvent = { type: 'run-started'; run: RunSnapshot } | { type: 'run-line'; runId: string; line: RunLine } | { type: 'run-ended'; run: RunSnapshot };

export class RunBusyError extends Error {
  constructor(readonly run: RunSnapshot) {
    super('Claude is already working in this project.');
    this.name = 'RunBusyError';
  }
}
export class NotApprovedError extends Error {
  constructor(message = 'This project is not approved for runs. Run `specboard init` first.') {
    super(message);
    this.name = 'NotApprovedError';
  }
}
function unavailableText(reason: 'not-installed' | 'logged-out', { blockedBy, maybeBlockedBy }: UnavailableDetail): string {
  if (blockedBy) return `Claude Code is inside a registered project (${blockedBy}), so runs won't use it.`;
  if (maybeBlockedBy) return `Claude Code didn't start. A folder inside a registered project (${maybeBlockedBy}) was left out of its PATH, which may be why.`;
  return reason === 'not-installed' ? "Claude Code isn't installed." : "Claude Code isn't logged in.";
}

type UnavailableDetail = Pick<ClaudeStatus, 'blockedBy' | 'maybeBlockedBy'>;

export class ClaudeUnavailableError extends Error {
  readonly detail: UnavailableDetail;

  constructor(readonly reason: 'not-installed' | 'logged-out', { blockedBy, maybeBlockedBy }: UnavailableDetail = {}) {
    const detail = { ...(blockedBy ? { blockedBy } : {}), ...(maybeBlockedBy ? { maybeBlockedBy } : {}) };
    super(unavailableText(reason, detail));
    this.detail = detail;
    this.name = 'ClaudeUnavailableError';
  }
}

type Launch = { bin: string; args: string[] };
type Launcher = (args: string[], exclude: string[]) => Launch;

/** How a run starts `name`: by an absolute path from outside every `exclude` folder, or it counts as not installed. */
export const commandLauncher = (name: string, env: NodeJS.ProcessEnv = process.env): Launcher => (args, exclude) => {
  const bin = resolveFromEnv(name, env, exclude);
  if (bin === null) throw new ClaudeUnavailableError('not-installed');
  return { bin, args };
};

const MAX_LINES = 2000;
const STDERR_TAIL = 4000;
/** After `exit`, how long to wait for `close`: something the run left behind can hold the pipe open for good. */
const EXIT_GRACE_MS = 2000;
const SIGKILL_AFTER_MS = 3000;
/** A stop never waits longer than this. */
const STOP_TIMEOUT_MS = 8000;
const WRITE_TRIES = 3;

const SPEC_ID = /^T-\d{3,}$/;

/** A token count for people: 950, 48.2k, 1.3M. */
export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n));
  const k = Math.round(n / 100) / 10;
  if (k < 1000) return `${k.toFixed(1)}k`;
  return `${(Math.round(n / 100000) / 10).toFixed(1)}M`;
}

/** The prompt for a run, built only from fixed strings and a validated spec ID. */
export function runPrompt(kind: RunKind, specId: string | null): string {
  if (kind === 'refresh-overview') {
    if (specId !== null) throw new Error('A spec ID does not belong on this kind of run.');
    return '/specboard:refresh-overview';
  }
  if (kind === 'sync-plan' || kind === 'sync-apply') {
    if (specId !== null && !SPEC_ID.test(specId)) throw new Error(`Invalid spec ID: ${specId}`);
    return `/specboard:sync-specs ${specId === null ? '' : `${specId} `}--board ${kind === 'sync-plan' ? '--dry-run' : '--apply'}`;
  }
  if (specId === null || !SPEC_ID.test(specId)) throw new Error(`Invalid spec ID: ${String(specId)}`);
  switch (kind) {
    case 'run': return `/specboard:run-spec ${specId}`;
    case 'write-up': return `/specboard:create-spec ${specId} --board`;
    case 'fix-file': return `/specboard:update-spec ${specId} Fix this file's formatting problems. Keep all content.`;
    case 'refresh-questions': return `/specboard:refresh-questions ${specId} --board`;
  }
}

/**
 * The `claude` arguments for an isolated run: only the approved lists and our own plugin apply. An empty
 * `--setting-sources` leaves out the project's and the person's settings, hooks, MCP servers and CLAUDE.md.
 */
export function buildRunArgs(prompt: string, approved: Permissions, kitDir: string): string[] {
  const settings = { permissions: { allow: approved.allow, deny: approved.deny }, disableAllHooks: true };
  return [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--permission-mode', 'dontAsk',
    '--setting-sources', '',
    '--plugin-dir', kitDir,
    '--settings', JSON.stringify(settings),
  ];
}

interface Run {
  snap: RunSnapshot;
  entry: ProjectEntry;
  seq: number;
  deny: string[];
  before: Spec | null;
  ticked: Set<number>;
  child: ChildProcess | null;
  splitter: LineSplitter;
  tally: LogTokenTally;
  result: ClaudeResult | null;
  stderrTail: string;
  spawnError: Error | null;
  exitCode: number | null;
  exited: boolean;
  stopped: boolean;
  announced: boolean;
  finishing: boolean;
  timers: NodeJS.Timeout[];
  finished: Promise<void>;
  markFinished: () => void;
}

const copy = (s: RunSnapshot): RunSnapshot => ({ ...s, lines: [...s.lines] });
const pad = (n: number): string => String(n).padStart(2, '0');
const hhmm = (d = new Date()): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

async function loadSpec(root: string, id: string | null): Promise<Spec | null> {
  if (id === null) return null;
  try {
    return (await loadProject(root)).specs.find((s) => s.id === id) ?? null;
  } catch {
    return null;
  }
}

/**
 * Removes the `current_subtask` a run left behind, which was `seen` when it ended. Someone else may be editing the
 * file: retry, stop if they changed the value, and give up quietly after a few tries.
 */
export async function clearCurrentSubtask(file: string, seen: number): Promise<void> {
  try {
    for (let i = 0; i < WRITE_TRIES; i++) {
      const text = await fs.readFile(file, 'utf8');
      if (parseSpec(text).currentSubtask !== seen) return;
      const res = await writeIfUnchanged(file, hashText(text), (t) => setMetaField(t, 'current_subtask', null));
      if (res.ok) return;
    }
  } catch {
    // the spec stays as it is; the board shows what the file says
  }
}

function deniedAction(end: EndInfo): string | undefined {
  const d = end.denied?.[0];
  if (!d) return undefined;
  const input = (d.input ?? {}) as { command?: unknown; file_path?: unknown };
  const what = typeof input.command === 'string' ? input.command : typeof input.file_path === 'string' ? input.file_path : d.tool;
  return what.split(/\r?\n/)[0]!.trim().slice(0, 200);
}

const FINISHED_TEXT: Record<Exclude<RunKind, 'run'>, string> = {
  'write-up': 'Spec written up',
  'fix-file': 'File fixed',
  'refresh-overview': 'Overview refreshed',
  'refresh-questions': 'Questions and subtasks refreshed',
  'sync-plan': 'Sync proposal ready',
  'sync-apply': 'Board synced with the code',
};

/** The last line of a run, with the token total at its end when it is known (after the code, when there is one). */
function finalLine(kind: RunKind, end: EndInfo, before: Spec | null, after: Spec | null): ParsedLine {
  const line = endLine(kind, end, before, after);
  if (!end.tokens) return line;
  const total = `· ${formatTokens(end.tokens.total)} tokens`;
  return line.code ? { ...line, after: total } : { ...line, text: `${line.text} ${total}` };
}

function endLine(kind: RunKind, end: EndInfo, before: Spec | null, after: Spec | null): ParsedLine {
  switch (end.status) {
    case 'finished': {
      if (kind !== 'run') return { k: 'done', text: FINISHED_TEXT[kind] };
      const commit = [...(after?.subtasks ?? [])].reverse().map((t) => after?.logs[t.n]?.commit).find(Boolean);
      const left = (after?.subtasks ?? []).filter((t) => !t.done && youStep(t.title) !== null).length;
      const text = left > 0 ? `Claude's subtasks done · ${left} left for you` : 'All subtasks done';
      return commit ? { k: 'done', text: `${text} · committed`, code: commit } : { k: 'done', text };
    }
    case 'stopped':
      return { k: 'stop', text: 'Stopped by you' };
    case 'needs': {
      if (end.waiting) return { k: 'warn', text: 'Paused: waiting on you', code: end.waiting };
      const known = new Set(before?.questions.map((q) => q.id));
      const added = after?.questions.some((q) => q.required && q.answer === null && !known.has(q.id));
      return { k: 'warn', text: added ? 'Paused: Claude added an open question' : 'Paused: an open question needs your answer' };
    }
    case 'permission':
      return { k: 'err', text: 'Not allowed:', code: deniedAction(end) };
    default:
      return { k: 'err', text: end.title ?? 'Claude Code exited unexpectedly' };
  }
}

const START_TEXT: Partial<Record<RunKind, string>> = {
  'refresh-overview': 'Started refreshing the overview',
  'sync-plan': 'Started checking the board against the code',
  'sync-apply': 'Started syncing the board with the code',
};

export class RunManager {
  private readonly approved: ApprovedPermissions;
  private readonly emit: (pid: string, e: RunEvent) => void;
  private readonly command: Launcher;
  private readonly status: ClaudeStatusCheck;
  private readonly roots: ProjectRoots;
  /** The run going on per project, including one still being prepared. Set before the first await in `start`. */
  private readonly active = new Map<string, Run>();
  private readonly last = new Map<string, Run>();
  private closed = false;

  constructor(opts: {
    approved: ApprovedPermissions;
    emit: (pid: string, e: RunEvent) => void;
    command?: Launcher;
    status?: ClaudeStatusCheck;
    /** Every registered project: a run's lookup and its PATH leave them all out, not only its own. */
    roots: ProjectRoots;
  }) {
    this.approved = opts.approved;
    this.emit = opts.emit;
    this.command = opts.command ?? commandLauncher('claude');
    this.status = opts.status ?? claudeStatus;
    this.roots = opts.roots;
  }

  async start(entry: ProjectEntry, kind: RunKind, specId: string | null): Promise<RunSnapshot> {
    if (this.closed) throw new Error('Spec Board is shutting down.');
    const prompt = runPrompt(kind, specId);
    const busy = this.active.get(entry.id);
    if (busy) throw new RunBusyError(copy(busy.snap));
    const run = this.newRun(entry, kind, specId);
    this.active.set(entry.id, run); // no await above this line: two starts at once cannot both get here

    let approved: Permissions;
    let launch: Launch | null;
    let exclude: string[];
    try {
      // `get` re-checks the stored rules: they go on a command line, and the file can be edited by hand.
      const perms = await this.approved.get(entry.id, entry.root).catch((e: unknown) => {
        throw e instanceof InvalidApprovalError ? new NotApprovedError(e.message) : e;
      });
      if (!perms) throw new NotApprovedError();
      approved = perms;
      const status = await this.status({ recheckIfDown: true });
      exclude = [...new Set([entry.root, ...(await this.roots())])]; // before the checks below: an unreadable list says so, not "not installed"
      if (!status.installed) throw new ClaudeUnavailableError('not-installed', status);
      if (!status.loggedIn) throw new ClaudeUnavailableError('logged-out');
      run.before = await loadSpec(entry.root, specId);
      if (specId !== null && !run.before) throw new Error(`Spec ${specId} was not found.`);
      // A proposal left from before must not pass for this plan's: the run's end checks that one was written.
      if (kind === 'sync-plan' && !run.stopped && !run.finishing) await deleteProposal(entry.root);
      launch = run.stopped || run.finishing ? null : this.command(buildRunArgs(prompt, approved, kitPluginDir()), exclude);
    } catch (e) {
      if (this.active.get(entry.id) === run) this.active.delete(entry.id);
      run.finishing = true; // nothing was started, so nothing ends: a stop waiting on this has no more to do
      for (const t of run.timers) clearTimeout(t);
      run.markFinished();
      throw e;
    }
    if (run.finishing) { // a stop gave up waiting for this start
      await run.finished;
      return copy(run.snap);
    }

    run.deny = approved.deny;
    run.ticked = new Set(run.before?.subtasks.filter((t) => t.done).map((t) => t.n));
    this.last.set(entry.id, run);
    this.addLine(run, { k: 'start', text: specId !== null ? `Started on ${specId} · ${run.before!.title}` : START_TEXT[kind] ?? 'Started' }, false);
    run.announced = true;
    this.send(run, { type: 'run-started', run: copy(run.snap) });

    if (launch === null) await this.finish(run); // stop or close arrived while this was being prepared
    else this.spawnChild(run, launch, exclude);
    return copy(run.snap);
  }

  /** Stops the run and everything it started. Resolves once it has ended; a stop cannot hang. */
  async stop(pid: string, runId: string): Promise<void> {
    const run = this.active.get(pid);
    if (!run || run.snap.id !== runId) return;
    if (!run.stopped && !run.exited && !run.finishing) {
      run.stopped = true;
      run.timers.push(setTimeout(() => void this.finish(run), STOP_TIMEOUT_MS));
      this.kill(run);
    }
    await run.finished;
  }

  current(pid: string): RunSnapshot | null {
    const run = this.last.get(pid);
    return run ? copy(run.snap) : null;
  }

  dismiss(pid: string, runId: string): void {
    const run = this.last.get(pid);
    if (run && run.snap.id === runId && run.snap.status !== 'running') run.snap.dismissed = true;
  }

  /** Call when a project's files change: adds a line for each subtask the running spec has newly ticked. */
  async projectChanged(entry: ProjectEntry): Promise<void> {
    const run = this.active.get(entry.id);
    if (!run || run.child === null || run.finishing) return;
    const spec = await loadSpec(entry.root, run.snap.specId);
    if (!run.finishing) this.addTickLines(run, spec);
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.all([...this.active.values()].map((run) => this.stop(run.snap.pid, run.snap.id)));
  }

  private newRun(entry: ProjectEntry, kind: RunKind, specId: string | null): Run {
    let markFinished = (): void => undefined;
    const finished = new Promise<void>((resolve) => (markFinished = resolve));
    return {
      snap: { id: randomUUID(), pid: entry.id, kind, specId, status: 'running', lines: [], end: null, startedAt: new Date().toISOString(), dismissed: false },
      entry, seq: 0, deny: [], before: null, ticked: new Set(), child: null, splitter: new LineSplitter(), tally: new LogTokenTally(entry.root), result: null, stderrTail: '',
      spawnError: null, exitCode: null, exited: false, stopped: false, announced: false, finishing: false, timers: [], finished, markFinished,
    };
  }

  private spawnChild(run: Run, { bin, args }: Launch, exclude: string[]): void {
    let child: ChildProcess;
    try {
      child = spawn(bin, args, { cwd: run.entry.root, env: childEnv(exclude), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      run.spawnError = e as Error;
      void this.finish(run);
      return;
    }
    run.child = child;
    // We never call child.kill or send messages, so `error` can only mean it did not start.
    child.on('error', (e) => {
      run.spawnError = e;
      void this.finish(run);
    });
    child.stdout!.on('error', () => undefined);
    child.stderr!.on('error', () => undefined);
    child.stdout!.on('data', (d: Buffer) => {
      if (!run.finishing) for (const line of run.splitter.push(d)) this.handleLine(run, line);
    });
    child.stderr!.on('data', (d: Buffer) => {
      run.stderrTail = (run.stderrTail + d.toString('utf8')).slice(-STDERR_TAIL);
    });
    child.on('exit', (code) => {
      run.exited = true;
      run.exitCode = code;
      run.timers.push(setTimeout(() => void this.finish(run), EXIT_GRACE_MS));
    });
    child.on('close', (code) => {
      run.exited = true;
      run.exitCode = run.exitCode ?? code;
      void this.finish(run);
    });
  }

  private kill(run: Run): void {
    const pid = run.child?.pid;
    if (pid === undefined) return;
    if (process.platform === 'win32') {
      killTree(pid, 'SIGKILL');
      return;
    }
    killTree(pid, 'SIGTERM');
    run.timers.push(setTimeout(() => {
      if (!run.exited) killTree(pid, 'SIGKILL');
    }, SIGKILL_AFTER_MS));
  }

  private handleLine(run: Run, line: string): void {
    const parsed = parseEvent(line, run.entry.root);
    if (!parsed) return;
    if (parsed.result) run.result = parsed.result;
    if (parsed.assistant) run.tally.push(parsed.assistant);
    for (const l of parsed.lines) this.addLine(run, l);
  }

  private addLine(run: Run, line: ParsedLine, send = true): void {
    const full: RunLine = { ...line, seq: ++run.seq, time: hhmm() };
    if (full.code === undefined) delete full.code;
    run.snap.lines.push(full);
    if (run.snap.lines.length > MAX_LINES) run.snap.lines.shift();
    if (send) this.send(run, { type: 'run-line', runId: run.snap.id, line: full });
  }

  private addTickLines(run: Run, spec: Spec | null): void {
    for (const t of spec?.subtasks ?? []) {
      if (!t.done || run.ticked.has(t.n)) continue;
      run.ticked.add(t.n);
      const commit = spec!.logs[t.n]?.commit ?? undefined;
      const text = `Subtask ${t.n} done: ${t.title}`;
      this.addLine(run, commit ? { k: 'done', text: `${text} · committed`, code: commit, subtask: t.n } : { k: 'done', text, subtask: t.n });
    }
  }

  /** The one way a run ends. Safe to call more than once, and always frees the project. */
  private async finish(run: Run): Promise<void> {
    if (run.finishing) return run.finished;
    run.finishing = true;
    for (const t of run.timers) clearTimeout(t);
    for (const line of run.splitter.flush()) this.handleLine(run, line);
    run.child?.stdout?.destroy();
    run.child?.stderr?.destroy();

    const { snap, entry } = run;
    if (!run.announced) { // stopped while being prepared, and the stop timer ran out: nobody has heard of this run
      snap.end = { status: 'stopped' };
      snap.status = 'stopped';
      if (this.active.get(entry.id) === run) this.active.delete(entry.id);
      run.markFinished();
      return;
    }

    // Without a process the spec's state is not this run's doing, so leave it alone.
    const ran = run.child !== null && run.spawnError === null;
    let end: EndInfo = { status: 'error', title: 'Claude Code exited unexpectedly' };
    try {
      const after = ran ? await loadSpec(entry.root, snap.specId) : null;
      this.addTickLines(run, after);
      end = run.spawnError && !run.stopped
        ? { status: 'error', title: "Couldn't start Claude Code", text: run.spawnError.message }
        : classifyEnd({
          stopped: run.stopped,
          exitCode: run.exitCode,
          result: run.result,
          stderrTail: run.stderrTail,
          kind: snap.kind,
          before: run.before,
          after,
          denyRules: run.deny,
        });
      if (snap.kind === 'sync-plan' && end.status === 'finished' && (await readProposalText(entry.root)) === null) {
        end = { status: 'error', title: 'Claude stopped before finishing', text: 'No sync proposal was written.' };
      }
      const u = run.result?.usage;
      if (u) end.tokens = { total: u.input + u.output + u.cacheRead + u.cacheWrite, input: u.input, output: u.output, cacheRead: u.cacheRead, cacheWrite: u.cacheWrite };
      if (after && after.currentSubtask !== null) await clearCurrentSubtask(after.path, after.currentSubtask);
      if (ran) await run.tally.save();
      if (snap.kind === 'sync-apply' && ran) end = await this.settleProposal(run, end);
      this.addLine(run, finalLine(snap.kind, end, run.before, after));
    } catch (e) {
      end = { status: 'error', title: 'Claude Code exited unexpectedly', text: (e as Error).message };
      this.addLine(run, finalLine(snap.kind, end, run.before, null));
    }
    if (run.stopped && run.child && !run.exited) this.addLine(run, { k: 'warn', text: 'Claude Code may still be running' });

    snap.end = end;
    snap.status = end.status;
    if (this.active.get(entry.id) === run) this.active.delete(entry.id);
    this.send(run, { type: 'run-ended', run: copy(snap) });
    run.markFinished();
  }

  /**
   * After a sync apply: reads the proposal and deletes it. The skill marks it `applied: true` as its last step; only then
   * does a finished run archive the specs it names. A finished run without the mark stopped on purpose (the code or the
   * scope changed), so it ends as an error with what Claude said. Never throws.
   */
  private async settleProposal(run: Run, end: EndInfo): Promise<EndInfo> {
    const root = run.entry.root;
    let ids: string[] = [];
    let applied = false;
    try {
      const raw = await readProposalText(root);
      if (raw !== null) {
        ids = archiveIds(parseProposal(raw).bodyMd);
        applied = proposalApplied(raw);
      }
    } catch {
      // an unreadable proposal names nothing to archive
    }
    try {
      await deleteProposal(root);
    } catch {
      // it stays; the next plan overwrites it
    }
    if (end.status !== 'finished') return end;
    if (!applied) {
      const said = run.result?.resultText.trim();
      return { ...end, status: 'error', title: 'Sync stopped', text: said || 'Claude did not apply the proposal.' };
    }
    for (const failure of await archiveProposed(root, ids)) this.addLine(run, { k: 'warn', text: failure });
    return end;
  }

  private send(run: Run, e: RunEvent): void {
    try {
      this.emit(run.snap.pid, e);
    } catch {
      // a listener's failure must not leave a run stuck
    }
  }
}
