import { useState } from 'react';
import type { Status } from '@specboard/core';
import { ESC, useEscape } from '../../lib/escape';
import { ORDER, ST } from '../../lib/vm';
import s from './detail.module.css';

export interface StatusMenuProps {
  status: Status;
  /** Called with a status different from the current one. */
  onPick: (status: Status) => void;
}

/** Status button and its menu (prototype lines 132-137, 690): notes "Current" and, on Done, "Approve". */
export function StatusMenu({ status, onPick }: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  useEscape(open, () => setOpen(false), ESC.menu);
  const st = ST[status];
  const pick = (k: Status) => {
    setOpen(false);
    if (k !== status) onPick(k);
  };
  return (
    <div className={s.statusWrap}>
      {open && <div className={s.statusScrim} data-testid="status-menu-scrim" onClick={() => setOpen(false)} />}
      <button
        type="button"
        className={s.statusBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ background: st.soft, color: st.ink }}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={s.statusIcon}>{st.icon}</span>
        {st.label}
        <span className={s.caret}>▾</span>
      </button>
      {open && (
        <div role="menu" aria-label="Status" className={s.menu}>
          {ORDER.map((k) => {
            const o = ST[k];
            const note = k === status ? 'Current' : k === 'done' ? 'Approve' : '';
            return (
              <button key={k} type="button" role="menuitemradio" aria-checked={k === status} className={s.menuItem} onClick={() => pick(k)}>
                <span className={s.menuIcon} style={{ color: o.ink }}>
                  {o.icon}
                </span>
                {o.label}
                {note && <span className={s.menuNote}>{note}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
