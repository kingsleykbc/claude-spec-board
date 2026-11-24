import { useCallback, useEffect, useRef } from 'react';
import { allowHint, initHint } from '../lib/prePublish';
import { isPluginMode } from '../lib/mode';
import type { Spec } from '@specboard/core';
import type { ClaudeStatus, RunEvent, RunKind, RunSnapshot } from '../api/client';
import type { RunState } from '@/components/card-detail/run-button/run-button';
import { OFFLINE_TOAST } from './actions';
import type { PushToast, ToastKind } from './toasts';
import type { StartResult, UseRun } from './useRun';

// What the board shows for the project's run: the Run button, the cards, the toasts and the refusals.

type ToastArgs = [kind: ToastKind, text: string, sub?: string];

const isRunning = (run: RunSnapshot | null): run is RunSnapshot => run?.status === 'running';

/** The Run button of `specId`, from the run this tab holds. A `claude` not loaded yet stays ready: `start` handles a refusal. */
/** Why Claude Code can't be used, when a folder left out of PATH is involved. Definite only when `claude` itself was in one. */
function blockedNote({ blockedBy, maybeBlockedBy }: { blockedBy?: string; maybeBlockedBy?: string }): string | null {
  if (blockedBy) return `Claude Code is inside a registered project (${blockedBy}), so runs won’t use it.`;
  if (maybeBlockedBy) return `Claude Code didn’t start. A folder inside a registered project (${maybeBlockedBy}) was left out of its PATH, which may be why.`;
  return null;
}

const isSync = (kind: RunKind | undefined) => kind === 'sync-plan' || kind === 'sync-apply';

export function runButtonState(
  run: RunSnapshot | null,
  specId: string,
  claude: ClaudeStatus | null,
): { runState: RunState; runningId: string | null; runBlockedNote?: string; runBusyNote?: string } {
  if (isRunning(run)) {
    const state = { runState: run.specId === specId ? ('running' as const) : ('disabled' as const), runningId: run.specId };
    // A project-level sync has no spec to name.
    return run.specId === null && isSync(run.kind) ? { ...state, runBusyNote: 'Claude is syncing the board with the code' } : state;
  }
  if (claude?.installed !== false) return { runState: 'ready', runningId: null };
  const note = blockedNote(claude);
  return { runState: 'fallback', runningId: null, ...(note ? { runBlockedNote: note } : {}) };
}

/** Why a start for `specId` would be refused right now (another run is going), in Run with Claude's words; null when it isn't. */
export function busyNote(run: RunSnapshot | null, specId: string): string | null {
  const s = runButtonState(run, specId, null);
  if (s.runState !== 'disabled') return null;
  return s.runBusyNote ?? `Claude is already working on ${s.runningId ?? 'the overview'}`;
}

export type ManualReason = 'not-installed' | 'not-logged-in' | 'blocked' | 'not-approved';

/**
 * Why the board can't run Claude here; null when it can, or when the status isn't known yet (nothing flashes while loading).
 * A `claude` found only inside a project reads as not installed, so `blockedBy` is checked first. `maybeBlockedBy` alone isn't blocked.
 */
export function manualReason(claude: ClaudeStatus | null, approved: boolean | null): ManualReason | null {
  if (!claude) return null;
  if (claude.blockedBy) return 'blocked';
  if (!claude.installed) return 'not-installed';
  if (!claude.loggedIn) return 'not-logged-in';
  if (approved === false) return 'not-approved';
  return null;
}

/**
 * What a run means for one spec: `running` and `writing` for its card, `runActive` for its subtask list.
 * `chat` is the step Claude is working on from a chat: the spec has a current step and no background run is going for it.
 */
export function cardRun(
  run: RunSnapshot | null,
  spec: Spec,
): { running: string | null; writing: boolean; runActive: boolean; chat: number | null } {
  if (!isRunning(run) || run.specId !== spec.id) return { running: null, writing: false, runActive: false, chat: spec.currentSubtask };
  if (run.kind === 'write-up') return { running: null, writing: true, runActive: false, chat: null };
  if (run.kind !== 'run' && run.kind !== 'fix-review') return { running: '', writing: false, runActive: false, chat: null };
  return { running: spec.subtasks.find((t) => t.n === spec.currentSubtask)?.title ?? '', writing: false, runActive: true, chat: null };
}

/** The refresh run in flight drives the Overview modal's Refreshing state. */
export const isRefreshing = (run: RunSnapshot | null): boolean => isRunning(run) && run.kind === 'refresh-overview';

/** A question refresh for `specId` is in flight: its stale warning waits for the outcome. */
export const isRefreshingQuestions = (run: RunSnapshot | null, specId: string): boolean =>
  isRunning(run) && run.kind === 'refresh-questions' && run.specId === specId;

function startedToast(run: RunSnapshot, title: string | undefined): ToastArgs | null {
  const id = run.specId;
  switch (run.kind) {
    case 'run':
      return ['run', `Claude started working on ${id} in the background.`, title];
    case 'fix-review':
      return ['run', `Claude started fixing ${id}’s failed checks in the background.`, title];
    case 'write-up':
      return ['run', `Claude is writing up ${id}`, 'Features, questions and subtasks will appear on the card.'];
    case 'fix-file':
      return ['run', `Asked Claude to fix ${id}`, title];
    case 'refresh-questions':
      return ['run', `Claude is checking ${id}’s questions and subtasks`, 'After your spec edit.'];
    case 'refresh-overview':
    case 'sync-plan':
    case 'sync-apply':
      return null; // the Overview modal and the sync dialog show these
  }
}

/** A sync run's ending. With a spec ID it names that card; a project-level one has none to name. */
function syncEndedToast(run: RunSnapshot): ToastArgs {
  const id = run.specId;
  const end = run.end;
  if (run.status === 'finished') {
    if (run.kind === 'sync-plan') return ['ok', id ? `${id} sync proposal ready` : 'Sync proposal ready'];
    return ['ok', id ? `${id} synced with the code` : 'Board synced with the code'];
  }
  if (run.status === 'stopped') return ['info', id ? `Stopped syncing ${id}` : 'Stopped the sync'];
  const failed = id ? `Couldn’t sync ${id}` : 'Couldn’t sync with the code';
  if (run.status === 'permission' && end?.fix) return ['err', failed, isPluginMode() ? allowHint(undefined, true) : `Run this in a terminal, then sync again: ${end.fix}`];
  return ['err', failed, end?.title ?? end?.text];
}

export function endedToast(run: RunSnapshot): ToastArgs {
  if (isSync(run.kind)) return syncEndedToast(run);
  const id = run.specId;
  const end = run.end;
  if (run.kind === 'refresh-overview') {
    if (run.status === 'finished') return ['ok', 'Overview updated', 'Claude rewrote the progress summary.'];
    // A refresh has no run panel, so the toast is the only place a refused action's rule can show.
    if (run.status === 'permission' && end?.fix) return ['err', 'Couldn’t refresh the overview', isPluginMode() ? allowHint(undefined, true) : `Run this in a terminal, then refresh again: ${end.fix}`];
    return ['err', 'Couldn’t refresh the overview', end?.title ?? end?.text];
  }
  switch (run.status) {
    case 'stopped':
      return ['info', `Stopped Claude on ${id}`, 'Work so far is committed.'];
    case 'needs':
      if (end?.waiting) return ['warn', `${id} is waiting on you`, end.waiting];
      return ['warn', `Claude needs your answer on ${id}`, end?.text];
    case 'permission':
      return ['err', `Claude stopped on ${id}`, 'It needs permission to continue.'];
    case 'error':
      return ['err', `Run failed on ${id}`, end?.title ?? end?.text];
    default:
      if (run.kind === 'write-up') return ['ok', `Claude wrote up ${id}`];
      if (run.kind === 'fix-file') return ['ok', `${id} is fixed`];
      if (run.kind === 'refresh-questions') return ['ok', `Refreshed ${id}’s questions and subtasks`];
      if (run.kind === 'fix-review') return ['ok', `${id} is back in Review`, 'Claude fixed the failed checks. Check them again.'];
      return ['ok', `${id} moved to Review`, 'Claude finished. Have a look when you can.'];
  }
}

/**
 * Shows each live run event as a toast. `onEvent` fires once per event and never for snapshots, so this is the only
 * place run toasts come from; a replay after a reconnect shows none.
 */
export function useRunToasts({ onEvent }: Pick<UseRun, 'onEvent'>, specs: Spec[], toast: PushToast): void {
  const specsRef = useRef(specs);
  specsRef.current = specs;

  useEffect(
    () =>
      onEvent((e: RunEvent, run: RunSnapshot) => {
        const spec = specsRef.current.find((s) => s.id === run.specId);
        let args: ToastArgs | null = null;
        if (e.type === 'run-started') {
          args = startedToast(run, spec?.title);
        } else if (e.type === 'run-ended') {
          args = endedToast(run);
        } else if ((run.kind === 'run' || run.kind === 'fix-review') && e.line.subtask !== undefined) {
          args = ['ok', `${run.specId} · Subtask done`, spec?.subtasks.find((t) => t.n === e.line.subtask)?.title];
        }
        if (args) toast(...args);
      }),
    [onEvent, toast],
  );
}

/** What to paste into a Claude chat in place of a run the board can't start; null for runs with no chat command. */
export function pasteCommand(kind: RunKind, specId: string | undefined): string | null {
  switch (kind) {
    case 'run':
      return specId ? `/run-spec ${specId}` : null;
    case 'fix-review':
      return specId ? `/fix-review ${specId}` : null;
    case 'write-up':
      return specId ? `/create-spec ${specId}` : null;
    case 'refresh-overview':
      return '/refresh-overview';
    default:
      return null;
  }
}

function refusalToast(r: Extract<StartResult, { ok: false }>, kind: RunKind, specId: string | undefined, root: string | undefined): ToastArgs {
  switch (r.reason) {
    case 'offline':
      return ['err', ...OFFLINE_TOAST];
    case 'not-approved':
    {
      const cmd = pasteCommand(kind, specId);
      return ['err', 'Claude isn’t connected', cmd ? `Paste ${cmd} into a Claude chat in this project, or ${initHint(root)}` : initHint(root)];
    }
    case 'logged-out':
      return ['err', 'Claude Code isn’t logged in', 'Run `claude` in a terminal and log in.'];
    case 'not-installed': {
      const note = blockedNote(r);
      return note ? ['err', 'Claude Code isn’t available', note] : ['err', 'Claude Code isn’t installed', 'Install Claude Code, then run again.'];
    }
    case 'busy':
      return ['err', `Claude is already working on ${r.run?.specId ?? (isSync(r.run?.kind) ? 'a sync' : 'the overview')}`];
    case 'error':
      return ['err', specId ? `Couldn’t reach Claude for ${specId}` : 'Couldn’t reach Claude', r.message];
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** `useRun`'s actions with their failures shown as toasts. */
export function useRunActions({ run, start, stop, dismiss }: Pick<UseRun, 'run' | 'start' | 'stop' | 'dismiss'>, toast: PushToast, root?: string) {
  /** Set synchronously, so a double click sends one start. */
  const starting = useRef(false);

  /** Resolves true once the run started; a refusal is toasted and gives false. */
  const startRun = useCallback(
    async (kind: RunKind, specId?: string): Promise<boolean> => {
      if (starting.current) return false;
      starting.current = true;
      try {
        const result = await start(kind, specId);
        if (!result.ok) toast(...refusalToast(result, kind, specId, root));
        return result.ok;
      } finally {
        starting.current = false;
      }
    },
    [start, toast, root],
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
