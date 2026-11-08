import { useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ESC, useEscape } from '../lib/escape';
import { useFocusTrap } from '../lib/focusTrap';
import s from './Modal.module.css';

export interface DialogAction {
  label: string;
  onClick: () => void;
  /** `primary` (accent) or `danger` (block colour); plain otherwise. */
  kind?: 'primary' | 'danger';
}

export interface DialogProps {
  title: string;
  body: string;
  /** Shown in a mono box under the body. */
  path?: string;
  actions: DialogAction[];
  /** Esc and a scrim click. */
  onDismiss: () => void;
}

/** Small confirm dialog over everything (prototype lines 381-388), rendered into document.body. */
export function Dialog({ title, body, path, actions, onDismiss }: DialogProps) {
  const box = useRef<HTMLDivElement | null>(null);
  useEscape(true, onDismiss, ESC.dialog);
  const onKeyDown = useFocusTrap(box, { initial: 'first' });
  const onScrim = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) onDismiss();
  };
  return createPortal(
    <div className={`${s.scrim} ${s.dScrim}`} onClick={onScrim}>
      <div ref={box} role="alertdialog" aria-modal="true" aria-label={title} tabIndex={-1} className={s.dialog} onKeyDown={onKeyDown}>
        <span className={s.dTitle}>{title}</span>
        <span className={s.dBody}>{body}</span>
        {path !== undefined && <span className={s.dPath}>{path}</span>}
        <div className={s.dActions}>
          {actions.map((a) => (
            <button key={a.label} type="button" className={s.dBtn} data-kind={a.kind} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
