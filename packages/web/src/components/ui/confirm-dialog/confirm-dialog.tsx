import { useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog } from '@/components/ui/dialog/dialog';
import { ESC, runEscape, useEscape } from '@/lib/escape';
import { useFocusTrap } from '@/lib/focusTrap';
import { layerOpen } from '@/lib/openLayer';
import { cn } from '@/lib/utils';
import { FileLink } from '@/state/fileLinks';

export interface ConfirmDialogAction {
  label: string;
  onClick: () => void;
  /** `primary` (accent) or `danger` (block colour); plain otherwise. */
  kind?: 'primary' | 'danger';
}

export interface ConfirmDialogProps {
  title: string;
  body: string;
  /** Shown in a mono box under the body. */
  path?: string;
  actions: ConfirmDialogAction[];
  /** Esc and a scrim click. */
  onDismiss: () => void;
}

const prevent = (e: Event) => e.preventDefault();

/**
 * Small confirm dialog over everything (prototype lines 381-388), rendered into document.body, on the
 * Radix dialog from `ui/dialog`. Esc goes through the `lib/escape` stack, as in `ui/modal`.
 */
export function ConfirmDialog({ title, body, path, actions, onDismiss }: ConfirmDialogProps) {
  const box = useRef<HTMLDivElement | null>(null);
  useEscape(true, onDismiss, ESC.dialog);
  const onKeyDown = useFocusTrap(box, { initial: 'first' });
  // As in Modal: only a press that started and ended on the scrim dismisses. React passes events from
  // the portal up to a modal underneath, so they stop here.
  // Also as in Modal: a press while a menu, popover or drawer is open only closes that layer.
  const pressedScrim = useRef(false);
  const layerAtPress = useRef(false);
  const onPress = () => {
    layerAtPress.current = layerOpen();
  };
  const onDown = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    pressedScrim.current = e.target === e.currentTarget && !layerAtPress.current;
    layerAtPress.current = false;
  };
  const onScrim = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const ok = pressedScrim.current && e.target === e.currentTarget;
    pressedScrim.current = false;
    if (ok) onDismiss();
  };
  return createPortal(
    <Dialog open modal={false}>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-8 [@media(max-width:640px)]:p-0"
        onPointerDownCapture={onPress}
        onMouseDown={onDown}
        onClick={onScrim}
      >
        <DialogPrimitive.Content
          ref={box}
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className="flex w-[min(460px,100%)] flex-col gap-2.5 rounded-[14px] border border-line bg-card px-6 pt-[22px] pb-5 font-sans text-fg shadow-lg outline-none"
          onKeyDown={onKeyDown}
          onOpenAutoFocus={prevent}
          onCloseAutoFocus={prevent}
          onInteractOutside={prevent}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            runEscape();
          }}
        >
          <DialogPrimitive.Title asChild>
            <span className="text-[16px] font-semibold">{title}</span>
          </DialogPrimitive.Title>
          <DialogPrimitive.Description asChild>
            <span className="text-[14px] leading-[1.55] text-pretty text-fg2">{body}</span>
          </DialogPrimitive.Description>
          {path !== undefined && (
            <FileLink path={path} className="rounded-md border border-line bg-code px-[9px] py-1.5 font-mono text-[12px] break-all text-fg2" />
          )}
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                data-kind={a.kind}
                className={cn(
                  'h-[34px] cursor-pointer rounded-lg border border-line2 bg-card px-3.5 py-0 font-[inherit] text-[13px] font-semibold text-fg',
                  a.kind === 'primary' && 'border-transparent bg-accent text-accent-fg',
                  a.kind === 'danger' && 'border-transparent bg-block text-card',
                )}
                onClick={a.onClick}
              >
                {a.label}
              </button>
            ))}
          </div>
        </DialogPrimitive.Content>
      </div>
    </Dialog>,
    document.body,
  );
}
