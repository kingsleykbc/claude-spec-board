import { useEffect, useRef, useState } from 'react';
import { InfoPopover } from '@/components/ui/info-popover/info-popover';
import { CheckIcon, CopyIcon, WarnIcon } from '@/lib/icons';

export interface RefreshWarningProps {
  /** The spec whose questions and subtasks may be stale. */
  id: string;
}

const COPIED_MS = 2600;

/** The command that refreshes a spec's questions and subtasks from a Claude chat. */
export const refreshCommand = (id: string) => `/specboard:refresh-questions ${id}`;

/**
 * The warning at the right end of the Open questions and Subtasks headings after a spec edit that no refresh run
 * picked up (`needs_refresh` in the file). It explains itself and copies the command to run in Claude.
 */
export function RefreshWarning({ id }: RefreshWarningProps) {
  const command = refreshCommand(id);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (next: 'copied' | 'failed') => {
    clearTimeout(timer.current);
    setCopy(next);
    timer.current = setTimeout(() => setCopy('idle'), COPIED_MS);
  };
  const doCopy = () => {
    let p: Promise<void>;
    try {
      const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      if (!clip) throw new Error('No clipboard');
      p = clip.writeText(command);
    } catch {
      show('failed');
      return;
    }
    // Confirm only once the browser says the text is on the clipboard.
    Promise.resolve(p).then(
      () => show('copied'),
      () => show('failed'),
    );
  };

  return (
    <InfoPopover label="Questions may be out of date" trigger={<WarnIcon aria-hidden className="block size-4 text-review-ink" />}>
      <span>
        These may be out of date after the last spec edit. Run{' '}
        <code className="rounded-[4px] border border-line bg-code px-[5px] font-mono text-[11.5px] break-all">{command}</code> in Claude.
      </span>
      <button
        type="button"
        className="mt-2 flex h-[28px] cursor-pointer items-center gap-1.5 rounded-[7px] border border-line2 bg-card px-2.5 py-0 text-[12.5px] font-semibold text-fg hover:bg-panel data-[copied=true]:border-done data-[copied=true]:text-done-ink"
        data-copied={copy === 'copied'}
        onClick={doCopy}
      >
        {copy === 'copied' ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        {copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Couldn’t copy' : 'Copy command'}
      </button>
    </InfoPopover>
  );
}
