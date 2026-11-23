import type { ReactNode } from 'react';
import notConnectedUrl from '@/assets/not-connected.svg';
import { InfoPopover } from '@/components/ui/info-popover/info-popover';
import { CheckIcon, CopyIcon } from '@/lib/icons';
import { useCopyCommand } from '@/lib/useCopyCommand';
import type { ManualReason } from '@/state/runUi';

/** The header icon's title, and its accessible name. */
export const NOT_CONNECTED_TITLE = "Claude isn’t connected to the board";
/** The title of the popover on a button that needs Claude (Run with Claude, Have Claude write this up, Refresh). */
export const NOT_CONNECTED_SHORT = "Claude isn’t connected";

const REASON: Record<ManualReason, string> = {
  'not-installed': "Claude Code isn't installed on this computer.",
  'not-logged-in': "Claude Code isn't logged in.",
  blocked: 'Claude Code is blocked by a setting.',
  'not-approved': "This project isn't set up for background runs.",
};

/**
 * The header's not-connected icon: the board can't run Claude here. A click or tap opens why, and how to
 * turn background runs on. Nothing when runs are available.
 */
export function NotConnected({ reason }: { reason: ManualReason | null }) {
  if (!reason) return null;
  return (
    <InfoPopover
      label={NOT_CONNECTED_TITLE}
      title={NOT_CONNECTED_TITLE}
      trigger={<img src={notConnectedUrl} alt="" width={22} height={22} className="block size-[22px] overflow-hidden rounded-md" />}
    >
      <NotConnectedBody reason={reason} />
    </InfoPopover>
  );
}

/**
 * Why the board can't run Claude here, and how to fix it. With a `command`, it says what to paste into a Claude
 * chat instead and offers to copy it; without one it is the header icon's generic explanation.
 */
export function NotConnectedBody({ reason, command }: { reason: ManualReason; command?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {command ? (
        <>
          <p className="m-0 font-medium text-fg">{REASON[reason]}</p>
          <p className="m-0">Paste this into a Claude chat open in this project:</p>
          <CommandCopy command={command} />
        </>
      ) : (
        <>
          <p className="m-0">The board can't run Claude for you here, so use the Copy command buttons and paste them into a Claude chat.</p>
          <p className="m-0 font-medium text-fg">{REASON[reason]}</p>
        </>
      )}
      <a className="font-medium text-accent-ink underline" href="/docs/running-specs#turn-on-background-runs" target="_blank" rel="noopener">
        How to turn on background runs
      </a>
    </div>
  );
}

/** A command to paste, in a box, with a Copy button that turns into "Copied". */
export function CommandCopy({ command }: { command: string }) {
  const { state, copy } = useCopyCommand(command);
  const copied = state === 'copied';
  return (
    <div className="flex flex-col gap-1.5">
      <code className="rounded-md bg-panel px-2 py-1.5 font-mono text-[12.5px] wrap-anywhere text-fg select-all">{command}</code>
      <button
        type="button"
        data-copied={copied}
        className="inline-flex h-7 cursor-pointer items-center gap-1.5 self-start rounded-lg border border-line2 bg-card px-2.5 text-[12.5px] font-semibold text-fg hover:bg-raise data-[copied=true]:border-done data-[copied=true]:text-done-ink"
        onClick={copy}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        {copied ? 'Copied' : 'Copy command'}
      </button>
      {state === 'failed' && <span className="text-[12px] text-block-ink">Copy failed. Select the command above and copy it by hand.</span>}
    </div>
  );
}

/** The greyed look of a button that needs Claude while it isn't connected: no accent fill, muted text and border. */
export const greyedButton =
  'inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-lg border border-line2 bg-panel py-0 pr-3.5 pl-3 text-[13px] font-semibold whitespace-nowrap text-fg3 hover:text-fg2 aria-expanded:text-fg2';

/**
 * A button that needs Claude, shown greyed while the board isn't connected to it. It is not `disabled`, so it
 * still takes hover and focus: those (and a click) open the popover with why and the command to paste.
 * Use it only when `reason` is not null.
 */
export function NotConnectedTrigger({
  label,
  reason,
  command,
  children,
  className = greyedButton,
}: {
  /** The button's accessible name. */
  label: string;
  reason: ManualReason;
  /** What to paste into a Claude chat instead. */
  command: string;
  /** The button's contents: icon and words. */
  children: ReactNode;
  /** Replaces the default size and shape, for a smaller button. */
  className?: string;
}) {
  return (
    <InfoPopover label={label} title={NOT_CONNECTED_SHORT} triggerClassName={className} description={NOT_CONNECTED_SHORT} trigger={children}>
      <NotConnectedBody reason={reason} command={command} />
    </InfoPopover>
  );
}
