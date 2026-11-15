import type { RunLine, SyncProposal } from '../api/client';
import { CloseIcon, CopyIcon, WarnIcon } from '../lib/icons';
import type { PushToast } from '../state/toasts';
import { Spinner } from '@/components/connection-banner/connection-banner';
import { Markdown } from '@/components/ui/markdown/markdown';
import { Modal } from '@/components/ui/modal/modal';
import s from './SyncDialog.module.css';

// Sync with code (design sections 10 and 11): the manual-mode command, the plan and apply runs' progress, and the
// confirm view of the proposal Claude wrote. Purely presentational: App's useSync drives it.

export type WaitingProposal = Extract<SyncProposal, { exists: true }>;

export type SyncView =
  | { kind: 'manual' }
  | { kind: 'running'; phase: 'plan' | 'apply'; lines: RunLine[] }
  | { kind: 'confirm'; proposal: WaitingProposal };

export interface SyncDialogProps {
  /** The spec being synced, or null for the whole project. */
  scope: string | null;
  view: SyncView;
  toast: PushToast;
  onStop: () => void;
  /** Delete the proposal and close (Cancel, Discard, or Close when there is nothing to change). */
  onDiscard: () => void;
  /** Apply the proposal. */
  onConfirm: () => void;
  /** Close without touching anything (Esc, the scrim, ×): a proposal stays waiting. */
  onClose: () => void;
  /** Where focus goes on close when the opener is gone (a logo-menu item): the logo button. */
  returnFocus?: () => HTMLElement | null;
}

export const syncCommand = (scope: string | null): string => (scope ? `/specboard:sync-specs ${scope}` : '/specboard:sync-specs');
export const syncTitle = (scope: string | null): string => (scope ? `Sync ${scope} with the code` : 'Sync with the code');

function changeLine(changes: number | null): string {
  if (changes === null) return 'This will change your specs.';
  return `This will change ${changes} ${changes === 1 ? 'spec' : 'specs'}.`;
}

export function SyncDialog({ scope, view, toast, onStop, onDiscard, onConfirm, onClose, returnFocus }: SyncDialogProps) {
  const title = view.kind === 'manual' ? 'Sync needs Claude' : syncTitle(scope);
  return (
    <Modal label={title} width="min(620px, 100%)" height="auto" onClose={onClose} returnFocus={returnFocus}>
      <div className={s.root}>
        <div className={s.head}>
          <h2 className={s.title}>{title}</h2>
          <button type="button" className={s.close} aria-label="Close dialog" onClick={onClose}>
            <CloseIcon aria-hidden />
          </button>
        </div>
        {view.kind === 'manual' && <Manual scope={scope} toast={toast} onClose={onClose} />}
        {view.kind === 'running' && <Running phase={view.phase} lines={view.lines} onStop={onStop} />}
        {view.kind === 'confirm' && <Confirm proposal={view.proposal} onDiscard={onDiscard} onConfirm={onConfirm} />}
      </div>
    </Modal>
  );
}

function Manual({ scope, toast, onClose }: { scope: string | null; toast: PushToast; onClose: () => void }) {
  const command = syncCommand(scope);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      toast('ok', 'Command copied', 'Paste it into a Claude chat open in this project.');
    } catch {
      toast('err', 'Couldn’t copy the command', command);
    }
  };
  return (
    <>
      <p className={s.text}>
        Syncing reads your code and git history and updates the specs to match, so Claude has to do it. The board can’t start Claude here. Paste this
        command into a Claude chat open in this project; it shows what will change and asks before changing anything.
      </p>
      <div className={s.command}>
        <code className={s.code}>{command}</code>
        <button type="button" className={s.btn} onClick={() => void copy()}>
          <CopyIcon aria-hidden /> Copy
        </button>
      </div>
      <div className={s.actions}>
        <button type="button" className={s.btn} onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

function Running({ phase, lines, onStop }: { phase: 'plan' | 'apply'; lines: RunLine[]; onStop: () => void }) {
  return (
    <>
      <p className={s.status}>
        <Spinner />
        {phase === 'plan' ? 'Claude is reading your code…' : 'Claude is updating your specs…'}
      </p>
      {lines.length > 0 && (
        <ol className={s.lines} aria-label="Run output">
          {lines.map((l) => (
            <li key={l.seq} className={s.line}>
              <span className={s.time}>{l.time}</span>
              <span>{l.text}</span>
              {l.code && <code className={s.lineCode}>{l.code}</code>}
            </li>
          ))}
        </ol>
      )}
      <div className={s.actions}>
        <button type="button" className={s.stop} onClick={onStop}>
          <span className={s.stopIcon} />
          Stop
        </button>
      </div>
    </>
  );
}

function Confirm({ proposal, onDiscard, onConfirm }: { proposal: WaitingProposal; onDiscard: () => void; onConfirm: () => void }) {
  const broken = proposal.problems.length > 0;
  if (!broken && proposal.changes === 0) {
    return (
      <>
        <p className={s.text}>Nothing to change. The board already matches the code.</p>
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={onDiscard}>
            Close
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      {broken ? (
        <p className={s.warn} data-kind="broken">
          <WarnIcon aria-hidden />
          This proposal can’t be read safely.
        </p>
      ) : (
        <p className={s.warn}>
          <WarnIcon aria-hidden />
          {changeLine(proposal.changes)}
        </p>
      )}
      <div className={s.body}>
        <Markdown md={proposal.bodyMd} size="sm" />
      </div>
      <div className={s.actions}>
        <button type="button" className={s.btn} onClick={onDiscard}>
          {broken ? 'Discard' : 'Cancel'}
        </button>
        <button type="button" className={s.primary} disabled={broken} onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </>
  );
}
