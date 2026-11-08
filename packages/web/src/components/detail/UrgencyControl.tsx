import type { Urgency } from '@specboard/core';
import { URG_KEYS, urgVm } from '../../lib/vm';
import s from './detail.module.css';

export interface UrgencyControlProps {
  value: Urgency;
  /** Called with an urgency different from the current one. */
  onPick: (u: Urgency) => void;
}

/** Segmented Low / Normal / High / Urgent control (prototype lines 140-142, 691). */
export function UrgencyControl({ value, onPick }: UrgencyControlProps) {
  return (
    <div role="radiogroup" aria-label="Urgency" className={s.seg}>
      {URG_KEYS.map((k) => {
        const u = urgVm(k);
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === value}
            className={s.segBtn}
            style={{ color: u.fg, fontWeight: u.weight }}
            onClick={() => {
              if (k !== value) onPick(k);
            }}
          >
            <span className={s.bars}>
              {u.bars.map((b, i) => (
                <span key={i} className={s.bar} style={{ height: b.h, background: b.c }} />
              ))}
            </span>
            {u.label}
          </button>
        );
      })}
    </div>
  );
}
