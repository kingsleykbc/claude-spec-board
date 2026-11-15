import { useEffect, useRef, useState, type ReactNode } from 'react';
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

/** How long the pointer may be away from the trigger and the content before the popover closes. */
const CLOSE_DELAY_MS = 150;

function canHover(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
}

/**
 * An indicator that carries information. With a mouse it opens on hover; the keyboard opens it on focus
 * (`:focus-visible` only, so focus returning after a dialog closes does not pop it); a click or tap toggles it
 * (a tooltip would never show on touch). Leaving the trigger and the content closes it after a short grace so a
 * link inside can be reached. Esc and a click outside close it.
 */
export function InfoPopover({ trigger, title, children, label }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Opened by hover or focus rather than a click: focus stays where it was. */
  const passive = useRef(false);
  /** A press is in progress: the focus it causes is not keyboard focus. */
  const pressing = useRef(false);
  /** Closing returns focus to the trigger; that focus must not open the popover again. */
  const returning = useRef(false);
  /** A click or Enter pinned it open: hover leave no longer closes it. */
  const pinned = useRef(false);
  /** Opened by keyboard focus: it closes again when focus leaves the trigger for somewhere other than the content. */
  const focusOpened = useRef(false);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const cancelClose = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  const scheduleClose = () => {
    cancelClose();
    if (pinned.current) return;
    timer.current = setTimeout(() => {
      focusOpened.current = false;
      setOpen(false);
    }, CLOSE_DELAY_MS);
  };
  useEffect(
    () => () => {
      cancelClose();
      clearTimeout(returnTimer.current);
    },
    [],
  );

  const openPassive = () => {
    cancelClose();
    passive.current = true;
    pinned.current = false;
    setOpen(true);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        cancelClose();
        if (next) passive.current = false;
        else pinned.current = focusOpened.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger
        aria-label={label}
        className="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 font-[inherit] text-inherit"
        onPointerEnter={(e) => {
          if (e.pointerType !== 'touch' && canHover()) openPassive();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch' && canHover()) scheduleClose();
        }}
        onPointerDown={() => {
          pressing.current = true;
        }}
        onBlur={(e) => {
          pressing.current = false;
          const into = e.relatedTarget instanceof Node && contentRef.current?.contains(e.relatedTarget);
          if (focusOpened.current && passive.current && !into) {
            focusOpened.current = false;
            setOpen(false);
          }
        }}
        onFocus={(e) => {
          if (!pressing.current && !returning.current && focusVisible(e.currentTarget)) {
            openPassive();
            focusOpened.current = true;
          }
        }}
        onClick={(e) => {
          pressing.current = false;
          // A click or Enter on a popover that hover or focus opened pins it open until Esc, a click outside or a
          // second click, and moves focus into it so its link can be reached.
          if (open && passive.current) {
            passive.current = false;
            pinned.current = true;
            focusOpened.current = false;
            cancelClose();
            e.preventDefault();
            contentRef.current?.focus();
          }
        }}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        aria-label={title ?? label}
        className="w-auto max-w-[min(320px,calc(100vw-32px))] px-3.5 py-3"
        onPointerEnter={cancelClose}
        onPointerLeave={() => canHover() && scheduleClose()}
        onOpenAutoFocus={(e) => passive.current && e.preventDefault()}
        onCloseAutoFocus={(e) => {
          if (passive.current) return e.preventDefault();
          returning.current = true;
          returnTimer.current = setTimeout(() => (returning.current = false), 0);
        }}
      >
        {title ? <div className="mb-1 text-[13.5px] font-semibold">{title}</div> : null}
        <div className="text-[13px] leading-[1.5] text-fg2">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
