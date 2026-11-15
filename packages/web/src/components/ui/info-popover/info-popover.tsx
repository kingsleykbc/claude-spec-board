import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover/popover';

export interface InfoPopoverProps {
  /** What the indicator shows (an icon, a dot, a short label). It sits inside the trigger button. */
  trigger: ReactNode;
  /** Bold first line of the popover; it also names the popover. */
  title?: string;
  children: ReactNode;
  /** The trigger's accessible name, e.g. "Why is this card obsolete?". */
  label: string;
}

/**
 * An indicator that carries information: a click or tap opens a small popover that explains it (a
 * tooltip would never show on touch). Esc and a click outside close it.
 */
export function InfoPopover({ trigger, title, children, label }: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 font-[inherit] text-inherit"
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent aria-label={title ?? label} className="w-auto max-w-[min(320px,calc(100vw-32px))] px-3.5 py-3">
        {title ? <div className="mb-1 text-[13.5px] font-semibold">{title}</div> : null}
        <div className="text-[13px] leading-[1.5] text-fg2">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
