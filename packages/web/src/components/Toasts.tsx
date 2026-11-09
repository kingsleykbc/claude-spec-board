import { TOAST, type Toast } from '../state/toasts';
import { CloseIcon } from '../lib/icons';
import s from './Toasts.module.css';

export interface ToastsProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

/** Bottom-left toast stack (prototype lines 390-396). */
export function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <div aria-live="polite" className={s.stack}>
      {toasts.map((t) => {
        const k = TOAST[t.kind];
        return (
          <div key={t.id} className={s.toast} data-kind={t.kind}>
            <span className={s.icon} style={{ background: k.bg, color: k.fg }}>
              <k.icon aria-hidden />
            </span>
            <div className={s.body}>
              <span className={s.text}>{t.text}</span>
              {t.sub ? <span className={s.sub}>{t.sub}</span> : null}
            </div>
            <button type="button" aria-label="Dismiss" className={s.close} onClick={() => onDismiss(t.id)}>
              <CloseIcon aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
