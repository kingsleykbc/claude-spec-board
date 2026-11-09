import { describe, expect, it } from 'vitest';
import type { ClaudeStatus, RunSnapshot } from '../api/client';
import { recipeSpec } from '../fixtures/recipeBox';
import { cardRun, runButtonState } from './runUi';

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
