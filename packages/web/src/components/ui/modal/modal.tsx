import { useRef, type MouseEvent, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog } from '@/components/ui/dialog/dialog';
import { ESC, runEscape, useEscape } from '@/lib/escape';
import { useFocusTrap } from '@/lib/focusTrap';

export interface ModalProps {
  /** Accessible name of the dialog. */
  label: string;
  /** CSS width, e.g. `min(900px, 100%)`. */
  width: string;
  /** CSS height; defaults to the card detail's `min(900px, calc(100vh - 64px))`. */
  height?: string;
  onClose: () => void;
  /** Where focus goes on close if the element that opened the modal is gone. */
  returnFocus?: () => HTMLElement | null;
  children: ReactNode;
}

const prevent = (e: Event) => e.preventDefault();

/**
 * Scrim plus a centred dialog box (prototype lines 120-122), on the Radix dialog from `ui/dialog`.
 * Esc and a scrim click close it; Tab stays inside; focus goes back to the opener on close.
 *
 * Radix is the layer underneath, so menus, popovers and tooltips opened inside sit above it and Esc
 * closes them first. Closing the modal itself stays with the board: Esc goes through the `lib/escape`
 * stack (an editor's discard guard or a confirm dialog above the modal answers first), and the scrim
 * closes only on a press that both starts and ends on it. Radix treats the dialog as non-modal, so the
 * toasts stay clickable; `aria-modal` and the focus trap keep it modal for people.
 */
export function Modal({ label, width, height = 'min(900px, calc(100vh - 64px))', onClose, returnFocus, children }: ModalProps) {
  const box = useRef<HTMLDivElement | null>(null);
  useEscape(true, onClose, ESC.modal);
  const onKeyDown = useFocusTrap(box, returnFocus ? { returnFocus } : {});
  // Close only for a press that both started and ended on the scrim, so a text selection
  // dragged out of the box does not close it (Ruling 17).
  const pressedScrim = useRef(false);
  const onDown = (e: MouseEvent<HTMLDivElement>) => {
    pressedScrim.current = e.target === e.currentTarget;
  };
  const onScrim = (e: MouseEvent<HTMLDivElement>) => {
    const ok = pressedScrim.current && e.target === e.currentTarget;
    pressedScrim.current = false;
    if (ok) onClose();
  };
  return (
    <Dialog open modal={false}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-8 [@media(max-width:640px)]:p-0"
        onMouseDown={onDown}
        onClick={onScrim}
      >
        {/* Width and height come from the caller; small screens fill the screen over them. */}
        <DialogPrimitive.Content
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          aria-describedby={undefined}
          tabIndex={-1}
          className="relative flex max-w-full flex-col overflow-hidden rounded-2xl border border-line bg-card font-sans text-fg shadow-lg outline-none [@media(max-width:640px)]:h-full! [@media(max-width:640px)]:w-full! [@media(max-width:640px)]:max-w-none [@media(max-width:640px)]:rounded-none"
          style={{ width, height }}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={prevent}
          onCloseAutoFocus={prevent}
          onInteractOutside={prevent}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            runEscape();
          }}
        >
          {children}
        </DialogPrimitive.Content>
      </div>
    </Dialog>
  );
}
