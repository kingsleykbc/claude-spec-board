import { describe, expect, it } from 'vitest';
import type { ClaudeStatus, RunSnapshot } from '../api/client';
import { recipeSpec } from '../fixtures/recipeBox';
import { cardRun, endedToast, manualReason, runButtonState } from './runUi';

const run = (over: Partial<RunSnapshot> = {}): RunSnapshot => ({
  id: 'r1',
  pid: 'p1',
  kind: 'run',
  specId: 'T-104',
  status: 'running',
  lines: [],
  end: null,
  startedAt: '2026-11-09T10:00:00.000Z',
  dismissed: false,
  ...over,
});
const OK: ClaudeStatus = { installed: true, loggedIn: true, version: '2.0.0' };
const NONE: ClaudeStatus = { installed: false, loggedIn: false, version: null };

describe('runButtonState', () => {
  it('running when this spec is running', () => {
    expect(runButtonState(run(), 'T-104', OK)).toEqual({ runState: 'running', runningId: 'T-104' });
  });
  it('disabled, naming the spec, when another spec is running', () => {
    expect(runButtonState(run(), 'T-103', OK)).toEqual({ runState: 'disabled', runningId: 'T-104' });
  });
  it('disabled with no spec while the overview refreshes', () => {
    expect(runButtonState(run({ kind: 'refresh-overview', specId: null }), 'T-103', OK)).toEqual({ runState: 'disabled', runningId: null });
  });
  it('running and disabled win over a missing Claude Code', () => {
    expect(runButtonState(run(), 'T-104', NONE).runState).toBe('running');
    expect(runButtonState(run(), 'T-103', NONE).runState).toBe('disabled');
  });
  it('fallback only when Claude Code is known to be missing', () => {
    expect(runButtonState(null, 'T-104', NONE).runState).toBe('fallback');
    expect(runButtonState(null, 'T-104', null).runState).toBe('ready');
  });
  it('passes on what blocked Claude Code only in the fallback', () => {
    const blocked = { ...NONE, blockedBy: 'C:\\p\\claude.cmd' };
    expect(runButtonState(null, 'T-104', blocked)).toEqual({
      runState: 'fallback',
      runningId: null,
      runBlockedNote: 'Claude Code is inside a registered project (C:\\p\\claude.cmd), so runs won’t use it.',
    });
    const maybe = { ...NONE, maybeBlockedBy: 'C:\\p\\.venv' };
    expect(runButtonState(null, 'T-104', maybe)).toEqual({
      runState: 'fallback',
      runningId: null,
      runBlockedNote: 'Claude Code didn’t start. A folder inside a registered project (C:\\p\\.venv) was left out of its PATH, which may be why.',
    });
    expect(runButtonState(null, 'T-104', NONE)).toEqual({ runState: 'fallback', runningId: null });
  });
  it('ready when idle, or after a run ended', () => {
    expect(runButtonState(null, 'T-104', OK).runState).toBe('ready');
    expect(runButtonState(run({ status: 'finished' }), 'T-104', OK).runState).toBe('ready');
  });
});

describe('cardRun', () => {
  const spec = { ...recipeSpec('T-104'), currentSubtask: 2 };
  const title = spec.subtasks.find((t) => t.n === 2)!.title;
  const idle = { running: null, writing: false, runActive: false };

  it('a run: the current subtask title, and active', () => {
    expect(cardRun(run(), spec)).toEqual({ running: title, writing: false, runActive: true });
  });
  it('a run with no current subtask: working, no name', () => {
    expect(cardRun(run(), { ...spec, currentSubtask: null })).toEqual({ running: '', writing: false, runActive: true });
  });
  it('a write-up: writing', () => {
    expect(cardRun(run({ kind: 'write-up' }), spec)).toEqual({ running: null, writing: true, runActive: false });
  });
  it('a fix: working, no subtask', () => {
    expect(cardRun(run({ kind: 'fix-file' }), spec)).toEqual({ running: '', writing: false, runActive: false });
  });
  it('nothing for another spec, an ended run, or no run', () => {
    expect(cardRun(run({ specId: 'T-103' }), spec)).toEqual(idle);
    expect(cardRun(run({ status: 'stopped' }), spec)).toEqual(idle);
    expect(cardRun(null, spec)).toEqual(idle);
  });
});

describe('endedToast', () => {
  it('a run waiting on a (you) step says so and names the step', () => {
    const end = { status: 'needs' as const, title: 'Waiting on you', text: 'Add the key', waiting: 'Add the key' };
    expect(endedToast(run({ status: 'needs', end }))).toEqual(['warn', 'T-104 is waiting on you', 'Add the key']);
  });
  it('a run that needs an answer is unchanged', () => {
    const end = { status: 'needs' as const, title: 'Claude has a question', text: 'There is 1 unanswered question on this spec.' };
    expect(endedToast(run({ status: 'needs', end }))).toEqual(['warn', 'Claude needs your answer on T-104', end.text]);
  });
});

describe('runButtonState during a sync', () => {
  it('a project-level sync says Claude is syncing the board', () => {
    expect(runButtonState(run({ kind: 'sync-plan', specId: null }), 'T-104', null)).toEqual({
      runState: 'disabled',
      runningId: null,
      runBusyNote: 'Claude is syncing the board with the code',
    });
  });
  it('a card-level sync on another spec names that spec, as before', () => {
    expect(runButtonState(run({ kind: 'sync-apply', specId: 'T-105' }), 'T-104', null)).toEqual({ runState: 'disabled', runningId: 'T-105' });
  });
});

describe('endedToast for sync runs', () => {
  const sync = (kind: 'sync-plan' | 'sync-apply', specId: string | null, status: RunSnapshot['status'], end: RunSnapshot['end'] = null) =>
    endedToast(run({ kind, specId, status, end }));
  it('project-level: no spec ID in the text', () => {
    expect(sync('sync-plan', null, 'finished')).toEqual(['ok', 'Sync proposal ready']);
    expect(sync('sync-apply', null, 'finished')).toEqual(['ok', 'Board synced with the code']);
    expect(sync('sync-plan', null, 'stopped')).toEqual(['info', 'Stopped the sync']);
    const end = { status: 'error' as const, title: 'Claude stopped before finishing', text: 'No sync proposal was written.' };
    expect(sync('sync-plan', null, 'error', end)).toEqual(['err', 'Couldn’t sync with the code', end.title]);
  });
  it('card-level: names the spec', () => {
    expect(sync('sync-plan', 'T-104', 'finished')).toEqual(['ok', 'T-104 sync proposal ready']);
    expect(sync('sync-apply', 'T-104', 'finished')).toEqual(['ok', 'T-104 synced with the code']);
    expect(sync('sync-apply', 'T-104', 'stopped')).toEqual(['info', 'Stopped syncing T-104']);
    expect(sync('sync-apply', 'T-104', 'error', { status: 'error', title: 'The code changed' })).toEqual(['err', 'Couldn’t sync T-104', 'The code changed']);
  });
  it('a refused command gives the fix to run', () => {
    expect(sync('sync-plan', null, 'permission', { status: 'permission', fix: 'specboard init' })).toEqual([
      'err',
      'Couldn’t sync with the code',
      'Run this in a terminal, then sync again: specboard init',
    ]);
  });
});

describe('manualReason', () => {
  const cases: [string, ClaudeStatus | null, boolean | null, string | null][] = [
    ['status not loaded yet', null, null, null],
    ['status not loaded, approved known', null, true, null],
    ['all good', OK, true, null],
    ['not installed', NONE, true, 'not-installed'],
    ['not installed beats not approved', NONE, false, 'not-installed'],
    ['blocked beats logged out', { installed: true, loggedIn: false, version: null, blockedBy: '/p' }, true, 'blocked'],
    ['blocked is how a not-installed claude reads when it sat in a project', { installed: false, loggedIn: false, version: null, blockedBy: '/p' }, true, 'blocked'],
    ['maybeBlockedBy alone is not blocked', { installed: true, loggedIn: true, version: '2.0.0', maybeBlockedBy: '/p' }, true, null],
    ['not logged in', { installed: true, loggedIn: false, version: '2.0.0' }, true, 'not-logged-in'],
    ['not approved', OK, false, 'not-approved'],
    ['approved unknown', OK, null, null],
  ];
  it.each(cases)('%s', (_n, claude, approved, want) => {
    expect(manualReason(claude, approved)).toBe(want);
  });
});
