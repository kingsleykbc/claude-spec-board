import { useCallback, useEffect, useRef } from 'react';
import type { Spec } from '@specboard/core';
import type { ClaudeStatus, RunEvent, RunKind, RunSnapshot } from '../api/client';
import type { RunState } from '../components/detail/RunButton';
import { OFFLINE_TOAST } from './actions';
import type { PushToast, ToastKind } from './toasts';
import type { StartResult, UseRun } from './useRun';

// What the board shows for the project's run: the Run button, the cards, the toasts and the refusals.

type ToastArgs = [kind: ToastKind, text: string, sub?: string];

const isRunning = (run: RunSnapshot | null): run is RunSnapshot => run?.status === 'running';

/** The Run button of `specId`, from the run this tab holds. A `claude` not loaded yet stays ready: `start` handles a refusal. */
export function runButtonState(run: RunSnapshot | null, specId: string, claude: ClaudeStatus | null): { runState: RunState; runningId: string | null } {
  if (isRunning(run)) return { runState: run.specId === specId ? 'running' : 'disabled', runningId: run.specId };
  return { runState: claude?.installed === false ? 'fallback' : 'ready', runningId: null };
}

/** What a run means for one spec: `running` and `writing` for its card, `runActive` for its subtask list. */
export function cardRun(run: RunSnapshot | null, spec: Spec): { running: string | null; writing: boolean; runActive: boolean } {
  if (!isRunning(run) || run.specId !== spec.id) return { running: null, writing: false, runActive: false };
  if (run.kind === 'write-up') return { running: null, writing: true, runActive: false };
  if (run.kind !== 'run') return { running: '', writing: false, runActive: false };
  return { running: spec.subtasks.find((t) => t.n === spec.currentSubtask)?.title ?? '', writing: false, runActive: true };
}

/** The refresh run in flight drives the Overview modal's Refreshing state. */
export const isRefreshing = (run: RunSnapshot | null): boolean => isRunning(run) && run.kind === 'refresh-overview';

/** A `done` line for one subtask ("Subtask 3 done: Name · committed"), as opposed to a run's closing `done` line. */
const SUBTASK_DONE = /^Subtask \d+ done: (.*?)(?: · committed)?$/;

function startedToast(run: RunSnapshot, title: string | undefined): ToastArgs | null {
  const id = run.specId;
  switch (run.kind) {
    case 'run':
      return ['run', `Claude started on ${id}`, title];
    case 'write-up':
      return ['run', `Claude is writing up ${id}`, 'Features, questions and subtasks will appear on the card.'];
    case 'fix-file':
      return ['run', `Asked Claude to fix ${id}`, title];
    case 'refresh-overview':
      return null; // the Overview modal shows it
  }
}

function endedToast(run: RunSnapshot): ToastArgs {
  const id = run.specId;
  const end = run.end;
  if (run.kind === 'refresh-overview') {
    return run.status === 'finished' ? ['ok', 'Overview updated', 'Claude rewrote the progress summary.'] : ['err', 'Couldn’t refresh the overview', end?.title ?? end?.text];
  }
  switch (run.status) {
    case 'stopped':
      return ['info', `Stopped Claude on ${id}`, 'Work so far is committed.'];
    case 'needs':
      return ['warn', `Claude needs your answer on ${id}`, end?.text];
    case 'permission':
      return ['err', `Claude stopped on ${id}`, 'It needs permission to continue.'];
    case 'error':
      return ['err', `Run failed on ${id}`, end?.title ?? end?.text];
    default:
      if (run.kind === 'write-up') return ['ok', `Claude wrote up ${id}`];
      if (run.kind === 'fix-file') return ['ok', `${id} is fixed`];
      return ['ok', `${id} moved to Review`, 'Claude finished. Have a look when you can.'];
  }
}

/**
 * Shows each live run event as a toast. `onEvent` fires once per event and never for snapshots, so this is the only
 * place run toasts come from; a replay after a reconnect shows none.
 */
export function useRunToasts({ run, onEvent }: Pick<UseRun, 'run' | 'onEvent'>, specs: Spec[], toast: PushToast): void {
  // A `run-line` names only its run. An event can land before the render that holds the run, so `run-started` sets this too.
  const held = useRef(run);
  held.current = run;
  const specsRef = useRef(specs);
  specsRef.current = specs;

  useEffect(
    () =>
      onEvent((e: RunEvent) => {
        let args: ToastArgs | null = null;
        if (e.type === 'run-started') {
          held.current = e.run;
          args = startedToast(e.run, specsRef.current.find((s) => s.id === e.run.specId)?.title);
        } else if (e.type === 'run-ended') {
          args = endedToast(e.run);
        } else {
          const cur = held.current;
          const subtask = e.line.k === 'done' && cur?.id === e.runId && cur.kind === 'run' ? SUBTASK_DONE.exec(e.line.text) : null;
          if (subtask) args = ['ok', `${cur!.specId} · Subtask done`, subtask[1]];
        }
        if (args) toast(...args);
      }),
    [onEvent, toast],
  );
}

function refusalToast(r: Extract<StartResult, { ok: false }>, specId: string | undefined): ToastArgs {
  switch (r.reason) {
    case 'offline':
      return ['err', ...OFFLINE_TOAST];
    case 'not-approved':
      return ['err', 'This project isn’t set up for runs', 'Run `specboard init` in a terminal.'];
    case 'logged-out':
      return ['err', 'Claude Code isn’t logged in', 'Run `claude` in a terminal and log in.'];
    case 'not-installed':
      return ['err', 'Claude Code isn’t installed', 'Install Claude Code, then run again.'];
    case 'busy':
      return ['err', `Claude is already working on ${r.run?.specId ?? 'the overview'}`];
    case 'error':
      return ['err', specId ? `Couldn’t reach Claude for ${specId}` : 'Couldn’t reach Claude', r.message];
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** `useRun`'s actions with their failures shown as toasts. */
export function useRunActions({ run, start, stop, dismiss }: Pick<UseRun, 'run' | 'start' | 'stop' | 'dismiss'>, toast: PushToast) {
  /** Set synchronously, so a double click sends one start. */
  const starting = useRef(false);

  const startRun = useCallback(
    async (kind: RunKind, specId?: string): Promise<void> => {
      if (starting.current) return;
      starting.current = true;
      try {
        const result = await start(kind, specId);
        if (!result.ok) toast(...refusalToast(result, specId));
      } finally {
        starting.current = false;
      }
    },
    [start, toast],
  );

  /** A rejected stop or dismiss: fetch rejects with a TypeError when the server cannot be reached. */
  const failed = (e: unknown, text: string) => {
    if (e instanceof TypeError) toast('err', ...OFFLINE_TOAST);
    else toast('err', text, message(e));
  };
  const stopRun = () => stop().catch((e: unknown) => failed(e, run?.specId ? `Couldn’t stop Claude on ${run.specId}` : 'Couldn’t stop Claude'));
  const dismissRun = () => dismiss().catch((e: unknown) => failed(e, 'Couldn’t dismiss the run'));

  return { startRun, stopRun, dismissRun };
}
