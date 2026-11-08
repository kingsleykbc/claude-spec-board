import type { Urgency as UrgencyLevel } from '@specboard/core';
import { urgVm } from '../lib/vm';
import s from './Urgency.module.css';

/** Three-bar urgency indicator with its label (prototype SpecCard.dc.html, urgency chip). */
export function Urgency({ level }: { level: UrgencyLevel }) {
  const u = urgVm(level);
  return (
    <span className={s.root} title="Urgency" data-urgency={level} style={{ padding: u.pad, background: u.bg }}>
      <span className={s.bars}>
        {u.bars.map((b, i) => (
          <span key={i} className={s.bar} style={{ height: b.h, background: b.c }} />
        ))}
      </span>
      <span className={s.label} style={{ color: u.fg, fontWeight: u.weight }}>
        {u.label}
      </span>
    </span>
  );
}
