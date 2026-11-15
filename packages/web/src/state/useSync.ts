import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type RunKind, type RunSnapshot } from '../api/client';
import type { SyncDialogProps, WaitingProposal } from '@/components/sync-dialog/sync-dialog';
import { OFFLINE_TOAST } from './actions';
import type { PushToast } from './toasts';

// Sync with code (design sections 10 and 11): plan with a `sync-plan` run, show the proposal, apply it with `sync-apply`.
// The server deletes the proposal after an apply, so only Cancel/Discard/Close here call DELETE.

type Phase = 'manual' | 'plan' | 'apply' | 'confirm';
interface Open {
  /** The spec being synced, or null for the whole project. */
  scope: string | null;
  phase: Phase;
  /** The project's run when the plan or apply was asked for: an older run, not this one. */
  before: string | null;
}

export interface UseSyncArgs {
  pid: string;
  /** Changes whenever the project is reloaded from the server (a file watcher event included), not on local writes, so the proposal is fetched again. */
  stamp: unknown;
  run: RunSnapshot | null;
  /** Runs aren't available here: the dialog gives the command instead. */
  manual: boolean;
  startRun: (kind: RunKind, specId?: string) => Promise<boolean>;
  stopRun: () => void;
  toast: PushToast;
}

export interface UseSync {
  /** The proposal file, when one is waiting. */
  proposal: WaitingProposal | null;
  /** Props for the open SyncDialog, or null when it is closed. */
  dialog: Omit<SyncDialogProps, 'toast'> | null;
  /** "Sync with code" (scope null) or a card's Sync. */
  openSync: (scope: string | null) => void;
  /** Reopen the waiting proposal's confirm view. */
  openWaiting: () => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useSync({ pid, stamp, run, manual, startRun, stopRun, toast }: UseSyncArgs): UseSync {
  const [open, setOpen] = useState<Open | null>(null);
  const [proposal, setProposal] = useState<WaitingProposal | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const seq = useRef(0);

  /** Fetch the proposal; resolves to it (null when there is none), or undefined when the fetch failed. */
  const fetchProposal = useCallback(async (): Promise<WaitingProposal | null | undefined> => {
    const mine = ++seq.current;
    try {
      const p = await api.syncProposal(pid);
      const next = p.exists ? p : null;
      if (mine === seq.current) setProposal(next);
      return next;
    } catch {
      return undefined;
    }
  }, [pid]);

  useEffect(() => {
    void fetchProposal();
  }, [fetchProposal, stamp]);

  // The plan or apply run this dialog started: same kind and scope, and not the run that was there before.
  const running = open && (open.phase === 'plan' || open.phase === 'apply') ? open : null;
  const syncRun =
    running && run && run.id !== running.before && run.kind === (running.phase === 'plan' ? 'sync-plan' : 'sync-apply') && run.specId === running.scope
      ? run
      : null;
  const endedId = syncRun && syncRun.status !== 'running' ? syncRun.id : null;
  const endedOk = syncRun?.status === 'finished';

  useEffect(() => {
    if (!endedId) return;
    // An apply, or a plan that didn't finish, closes: its toast says how it went.
    if (open?.phase !== 'plan' || !endedOk) {
      setOpen(null);
      return;
    }
    void fetchProposal().then((p) => {
      if (p === undefined) toast('err', 'Couldn’t load the sync proposal');
      // This fetch was made after the run ended, so its answer is current even if a reload's fetch started after it
      // and is still out: store it, or the confirm view would open with no proposal and close again.
      else if (p) setProposal(p);
      setOpen((o) => (o?.phase === 'plan' ? (p ? { ...o, phase: 'confirm' } : null) : o));
    });
    // Deliberately keyed on the run ending alone, so it is handled once. (No hooks lint in this repo to silence.)
  }, [endedId]);

  // The proposal went away (discarded elsewhere, applied): nothing left to confirm.
  useEffect(() => {
    if (open?.phase === 'confirm' && !proposal) setOpen(null);
  }, [open?.phase, proposal]);

  const openSync = useCallback(
    (scope: string | null) => {
      if (manual) {
        setOpen({ scope, phase: 'manual', before: null });
        return;
      }
      setOpen({ scope, phase: 'plan', before: runRef.current?.id ?? null });
      void startRun('sync-plan', scope ?? undefined).then((ok) => {
        if (!ok) setOpen(null);
      });
    },
    [manual, startRun],
  );

  const openWaiting = useCallback(() => {
    if (proposal) setOpen({ scope: proposal.scope, phase: 'confirm', before: null });
  }, [proposal]);

  const confirm = useCallback(() => {
    if (!open) return;
    const { scope } = open;
    setOpen({ scope, phase: 'apply', before: runRef.current?.id ?? null });
    void startRun('sync-apply', scope ?? undefined).then((ok) => {
      // Refused (busy, offline): back to the proposal, which is still there.
      if (!ok) setOpen({ scope, phase: 'confirm', before: null });
    });
  }, [open, startRun]);

  const discard = useCallback(() => {
    setOpen(null);
    setProposal(null);
    seq.current++;
    api.discardSyncProposal(pid).catch((e: unknown) => {
      if (e instanceof TypeError) toast('err', ...OFFLINE_TOAST);
      else toast('err', 'Couldn’t discard the sync proposal', message(e));
      void fetchProposal();
    });
  }, [pid, toast, fetchProposal]);

  let dialog: UseSync['dialog'] = null;
  if (open) {
    const view: SyncDialogProps['view'] | null =
      open.phase === 'manual'
        ? { kind: 'manual' }
        : open.phase === 'confirm'
          ? proposal && { kind: 'confirm', proposal }
          : { kind: 'running', phase: open.phase, lines: syncRun?.lines ?? [] };
    if (view) dialog = { scope: open.scope, view, onStop: stopRun, onDiscard: discard, onConfirm: confirm, onClose: () => setOpen(null) };
  }

  return { proposal, dialog, openSync, openWaiting };
}
