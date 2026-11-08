import { useRef, type MouseEvent, type ReactNode } from 'react';
import { ESC, useEscape } from '../lib/escape';
import { useFocusTrap } from '../lib/focusTrap';
import s from './Modal.module.css';

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

/** Scrim plus a centred dialog box (prototype lines 120-122). Esc and a scrim click close it; Tab stays inside. */
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
    <div className={s.scrim} onMouseDown={onDown} onClick={onScrim}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={s.box} style={{ width, height }} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}
