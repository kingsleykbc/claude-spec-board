import { docsPath } from '@/lib/docsPages';
import { CheckIcon, CopyIcon, HelpIcon, PlayIcon } from '@/lib/icons';
import { Hint } from '@/components/ui/hint/hint';
import { NotConnectedTrigger } from '@/components/not-connected/not-connected';
import { COPIED_MS, COPY_FAILED_MS, useCopyCommand } from '@/lib/useCopyCommand';
import type { ManualReason } from '@/state/runUi';
import { cn } from '@/lib/utils';

export type RunState = 'ready' | 'running' | 'disabled' | 'fallback';

export interface RunButtonProps {
  id: string;
  state: RunState;
  /** The spec Claude is working on, for the disabled note; null while it refreshes the overview. */
  runningId?: string | null;
  /** Why this spec shouldn't start yet (blocked or a draft), so no usage is spent finding out. */
  hold?: string | null;
  /** In the fallback: what a registered project has to do with it, since "not found" would mislead. */
  blockedNote?: string | undefined;
  /** The disabled note when the active run has no spec to name and isn't the overview (a project-level sync). */
  busyNote?: string | undefined;
  /** Why the board can't run Claude here (null when it can). A click on Run with Claude then explains instead of starting. */
  manual: ManualReason | null;
  /** Claude's status and the project's approval have loaded; until then Run with Claude waits. */
  statusKnown: boolean;
  onRun: () => void;
  onStop: () => void;
}

export { COPIED_MS, COPY_FAILED_MS };

export const CHAT_TITLE = 'Copies the command to paste into a Claude chat open in this project. You see all the work in that chat, and this card follows along. It uses your normal Claude settings and approvals.';
export const BACKGROUND_TITLE =
  'Starts a separate Claude with its output on this card. It can’t ask you anything, ignores the project’s and your Claude settings, and can only do what you approved. Best for a repo you don’t fully trust. Uses background runs when this project is connected.';
const HELP = 'Chat or background: which to use';

const button = 'flex h-[34px] items-center gap-2 rounded-lg py-0 pr-3.5 pl-3 text-[13px] font-semibold whitespace-nowrap';
/** Copy run command (and the header's Sync): the secondary buttons. */
export const secondaryButton = cn(
  button,
  'cursor-pointer border border-line2 bg-card text-fg hover:border-fg3 hover:bg-raise data-[copied=true]:border-done data-[copied=true]:text-done-ink',
);
/** Run with Claude: the card's one filled button. */
const primaryButton = cn(button, 'cursor-pointer border-0 bg-accent text-accent-fg hover:bg-accent-hover');
/** The same button while nothing can start. */
export const offButton = cn(button, 'cursor-not-allowed border-0 bg-panel text-fg3');
/** A one-line note beside the buttons (cut with … when it doesn't fit, except on phones). */
const note = 'min-w-0 flex-[0_1_auto] overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-fg3 [@media(max-width:640px)]:whitespace-normal';

/**
 * The header's Run controls in their four states (prototype lines 128-131, 679-683). Run with Claude is the primary
 * button: it starts a background run, or, when the board isn't connected to Claude, opens the notice that says why.
 * Copy run command stays beside it for a Claude chat (the board can't type into one).
 * docs/guide/running-specs.md says when to use which.
 */
export function RunButton({ id, state, runningId, hold, blockedNote, busyNote, manual, statusKnown, onRun, onStop }: RunButtonProps) {
  const command = `/run-spec ${id}`;
  const { state: copy, copy: doCopy } = useCopyCommand(command);

  if (state === 'running') {
    return (
      <button
        type="button"
        className="flex h-[34px] cursor-pointer items-center gap-2 rounded-lg border border-line2 bg-card py-0 pr-3.5 pl-3 text-[13px] font-semibold text-fg hover:bg-panel"
        onClick={onStop}
      >
        <span className="size-[9px] rounded-[2px] bg-fg" />
        Stop
      </button>
    );
  }

  const help = (
    <Hint label={HELP}>
      <a
        className="flex size-6 flex-none items-center justify-center rounded-full border-0 text-[16px] font-semibold text-fg2 no-underline hover:bg-panel hover:text-fg2"
        href={docsPath('running-specs')}
        target="_blank"
        rel="noopener"
        aria-label={HELP}
      >
        <HelpIcon aria-hidden />
      </a>
    </Hint>
  );
  const runLabel = (
    <>
      <PlayIcon aria-hidden className="text-[12px]" />
      Run with Claude
    </>
  );
  // Not connected: the same button explains why instead of starting. Status not loaded yet: it waits, so nothing is
  // started or explained wrongly.
  const runWithClaude =
    manual && statusKnown ? (
      <NotConnectedTrigger label="Run with Claude" reason={manual} command={command}>
        {runLabel}
      </NotConnectedTrigger>
    ) : statusKnown ? (
      <Hint label={BACKGROUND_TITLE}>
        <button type="button" className={primaryButton} aria-label="Run with Claude" onClick={onRun}>
          {runLabel}
        </button>
      </Hint>
    ) : (
      // Status not loaded: the neutral secondary style (no accent flash), nothing opens on hover, a click waits.
      <button type="button" className={secondaryButton} aria-label="Run with Claude" aria-disabled>
        {runLabel}
      </button>
    );
  const copied = copy === 'copied';
  const failedNote = copy === 'failed' && (
    <span className="min-w-0 flex-[0_1_auto] text-[12px] wrap-anywhere text-block-ink select-text" data-testid="copy-failed">
      Copy failed: paste <span className="font-mono select-all">{command}</span> into your Claude chat
    </span>
  );
  const copyName = copied ? 'Copied' : 'Copy run command';
  const copyButton = (
    <Hint label={CHAT_TITLE}>
      <button type="button" className={secondaryButton} data-copied={copied} aria-label={copyName} onClick={doCopy}>
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        {copyName}
      </button>
    </Hint>
  );

  // Another run is going, or the spec can't start: neither way should begin.
  const off = state === 'disabled' ? (busyNote ?? `Claude is already working on ${runningId ?? 'the overview'}`) : state === 'ready' ? hold : null;
  if (off) {
    // A disabled button gets no hover, so the reason stays a native title here.
    return (
      <>
        <span className={note} title={off}>
          {off}
        </span>
        <button type="button" className={offButton} disabled title={off}>
          <CopyIcon aria-hidden />
          Copy run command
        </button>
      </>
    );
  }

  if (state === 'fallback') {
    return (
      <>
        {failedNote ||
          (blockedNote ? (
            // Holds a path, which must stay readable: wraps, even in the middle of a long folder name.
            <span className="min-w-0 flex-[0_1_auto] text-[12px] wrap-anywhere text-fg3">{blockedNote}</span>
          ) : (
            <span className={note}>Claude Code not found</span>
          ))}
        {help}
        {/* Claude Code isn't there: the primary button opens the notice, so there is always a working button or the reason. */}
        {manual ? runWithClaude : null}
        {copyButton}
      </>
    );
  }

  return (
    <>
      {failedNote}
      {help}
      {runWithClaude}
      {copyButton}
    </>
  );
}
