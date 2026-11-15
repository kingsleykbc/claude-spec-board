import notConnectedUrl from '@/assets/not-connected.svg';
import { InfoPopover } from '@/components/ui/info-popover/info-popover';
import type { ManualReason } from '@/state/runUi';

/** The popover's title, and the icon's accessible name. */
export const NOT_CONNECTED_TITLE = "Claude isn't connected to the board";

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
      <div className="flex flex-col gap-2">
        <p className="m-0">The board can't run Claude for you here, so use the Copy command buttons and paste them into a Claude chat.</p>
        <p className="m-0 font-medium text-fg">{REASON[reason]}</p>
        <a className="font-medium text-accent-ink" href="/docs/running-specs#turn-on-background-runs" target="_blank" rel="noopener">
          How to turn on background runs
        </a>
      </div>
    </InfoPopover>
  );
}
