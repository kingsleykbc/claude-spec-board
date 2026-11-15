import type { RunLine, SyncProposal } from '@/api/client';
import { CloseIcon, CopyIcon, WarnIcon } from '@/lib/icons';
import type { PushToast } from '@/state/toasts';
import { Spinner } from '@/components/connection-banner/connection-banner';
import { Markdown } from '@/components/ui/markdown/markdown';
import { Modal } from '@/components/ui/modal/modal';
import { Hint } from '@/components/ui/hint/hint';
import { cn } from '@/lib/utils';

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

const btn =
  'flex h-[34px] cursor-pointer items-center gap-[7px] rounded-lg border border-line2 bg-card px-3.5 py-0 text-[13px] font-semibold whitespace-nowrap text-fg hover:bg-panel';
const text = 'm-0 text-[14px] leading-[1.6] text-pretty text-fg2';
const actions = 'flex flex-wrap justify-end gap-2';
const warn = 'm-0 flex items-center gap-2 rounded-lg px-3 py-[9px] text-[14px] font-semibold';

function changeLine(changes: number | null): string {
  if (changes === null) return 'This will change your specs.';
  return `This will change ${changes} ${changes === 1 ? 'spec' : 'specs'}.`;
}

export function SyncDialog({ scope, view, toast, onStop, onDiscard, onConfirm, onClose, returnFocus }: SyncDialogProps) {
  const title = view.kind === 'manual' ? 'Sync needs Claude' : syncTitle(scope);
  return (
    <Modal label={title} width="min(620px, 100%)" height="auto" onClose={onClose} returnFocus={returnFocus}>
      <div className="flex max-h-[calc(100vh-64px)] flex-col gap-3.5 overflow-auto pt-[18px] pr-5 pb-5 pl-6">
        <div className="flex items-center gap-3">
          <h2 className="m-0 flex-1 text-[18px] font-semibold tracking-[-0.01em]">{title}</h2>
          <Hint label="Close dialog">
            <button
              type="button"
              className="flex size-[34px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-[18px] text-fg2 hover:bg-panel"
              aria-label="Close dialog"
              onClick={onClose}
            >
              <CloseIcon aria-hidden />
            </button>
          </Hint>
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
      <p className={text}>
        Syncing reads your code and git history and updates the specs to match, so Claude has to do it. The board can’t start Claude here. Paste this
        command into a Claude chat open in this project; it shows what will change and asks before changing anything.
      </p>
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-code py-2 pr-2 pl-3">
        <code className="min-w-0 flex-1 font-mono text-[13px] [overflow-wrap:anywhere] text-fg select-all">{command}</code>
        <button type="button" className={btn} onClick={() => void copy()}>
          <CopyIcon aria-hidden /> Copy
        </button>
      </div>
      <div className={actions}>
        <button type="button" className={btn} onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

function Running({ phase, lines, onStop }: { phase: 'plan' | 'apply'; lines: RunLine[]; onStop: () => void }) {
  return (
    <>
      <p className="m-0 flex items-center gap-2 text-[14px] text-fg2">
        <Spinner />
        {phase === 'plan' ? 'Claude is reading your code…' : 'Claude is updating your specs…'}
      </p>
      {lines.length > 0 && (
        <ol className="m-0 flex max-h-[260px] list-none flex-col gap-1 overflow-auto rounded-lg border border-line bg-code px-3 py-2.5 text-[12.5px] text-fg2" aria-label="Run output">
          {lines.map((l) => (
            <li key={l.seq} className="flex min-w-0 items-baseline gap-2">
              <span className="flex-none font-mono text-fg3">{l.time}</span>
              <span>{l.text}</span>
              {l.code && <code className="min-w-0 font-mono [overflow-wrap:anywhere] text-fg">{l.code}</code>}
            </li>
          ))}
        </ol>
      )}
      <div className={actions}>
        <button type="button" className="flex h-[34px] cursor-pointer items-center gap-2 rounded-lg border border-line2 bg-card py-0 pr-3.5 pl-3 text-[13px] font-semibold text-fg hover:bg-panel" onClick={onStop}>
          <span className="size-[9px] rounded-[2px] bg-fg" />
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
        <p className={text}>Nothing to change. The board already matches the code.</p>
        <div className={actions}>
          <button type="button" className={btn} onClick={onDiscard}>
            Close
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      {broken ? (
        <p className={cn(warn, 'bg-block-soft text-block-ink')} data-kind="broken">
          <WarnIcon aria-hidden />
          This proposal can’t be read safely.
        </p>
      ) : (
        <p className={cn(warn, 'bg-review-soft text-review-ink')}>
          <WarnIcon aria-hidden />
          {changeLine(proposal.changes)}
        </p>
      )}
      <div className="max-h-[50vh] overflow-auto rounded-lg border border-line px-3.5 py-3">
        <Markdown md={proposal.bodyMd} size="sm" />
      </div>
      <div className={actions}>
        <button type="button" className={btn} onClick={onDiscard}>
          {broken ? 'Discard' : 'Cancel'}
        </button>
        <button type="button" className="h-[34px] cursor-pointer rounded-lg border-0 bg-accent px-4 py-0 text-[13px] font-semibold text-accent-fg disabled:cursor-not-allowed disabled:bg-panel disabled:text-fg3" disabled={broken} onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </>
  );
}
