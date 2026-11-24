import { PlayIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { NotConnectedTrigger } from '@/components/not-connected/not-connected';
import { StartButton, type StartHandler } from '@/components/ui/start-button/start-button';
import type { ManualReason } from '@/state/runUi';

export interface WriteUpButtonProps {
  id: string;
  /** Why the board can't run Claude here (null when it can). The button then greys and shows the command to paste. */
  manual: ManualReason | null;
  /** Claude's status and the project's approval have loaded; until then the button is neutral and waits. */
  statusKnown?: boolean;
  /** Starts the write-up run. It may return a promise of the start: the button says Starting… until it settles. */
  onWriteUp: StartHandler;
  /** Why a start would be refused now (another run is going). The button is then disabled with this as its note. */
  busyNote?: string | null;
  /** `sm` on a card, `md` in the card detail's header. */
  size?: 'sm' | 'md';
}

const SIZE = { sm: 'h-6 gap-1.5 rounded-md px-[9px] text-xs', md: 'h-[34px] gap-2 rounded-lg px-3 text-[13px]' } as const;
const FIT = 'inline-flex cursor-pointer items-center border-0 py-0 font-semibold whitespace-nowrap';

/** The command that does the same as the button, for a Claude chat. */
export const writeUpCommand = (id: string) => `/create-spec ${id}`;

/**
 * "Have Claude write this up" on a draft. Starts a write-up run; while the board isn't connected to Claude it is
 * greyed and a hover, focus or click explains why and offers the command to paste. While Claude's status isn't known
 * yet it uses the neutral secondary style (no accent fill, not greyed), opens nothing, and a click waits.
 */
export function WriteUpButton({ id, manual, statusKnown = true, onWriteUp, busyNote = null, size = 'sm' }: WriteUpButtonProps) {
  const icon = <PlayIcon aria-hidden className={size === 'sm' ? 'text-[11px]' : 'text-[12px]'} />;
  if (!statusKnown) {
    return (
      <button type="button" className={cn(FIT, SIZE[size], 'border border-line2 bg-card text-fg hover:border-fg3 hover:bg-raise')} aria-disabled>
        {icon}
        Have Claude write this up
      </button>
    );
  }
  if (manual) {
    return (
      <NotConnectedTrigger
        label="Have Claude write this up"
        reason={manual}
        command={writeUpCommand(id)}
        className={cn(FIT, SIZE[size], 'border border-line2 bg-panel text-fg3 hover:text-fg2 aria-expanded:text-fg2')}
      >
        {icon}
        Have Claude write this up
      </NotConnectedTrigger>
    );
  }
  if (busyNote) {
    // A disabled button gets no hover, so the reason stays a native title, as on Run with Claude.
    return (
      <button type="button" disabled title={busyNote} className={cn(FIT, SIZE[size], 'cursor-not-allowed bg-panel text-fg3')}>
        {icon}
        Have Claude write this up
      </button>
    );
  }
  return (
    <StartButton
      className={cn(FIT, SIZE[size], 'bg-accent-soft text-accent-ink enabled:hover:bg-accent enabled:hover:text-accent-fg disabled:cursor-default')}
      onStart={onWriteUp}
    >
      {icon}
      Have Claude write this up
    </StartButton>
  );
}
