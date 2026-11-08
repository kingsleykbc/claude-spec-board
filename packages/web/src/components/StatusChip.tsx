import type { Status } from '@specboard/core';
import { statusMeta } from '../lib/vm';
import s from './StatusChip.module.css';

/** Status pill (To-do, Doing, Review, Done) or the Blocked pill (prototype "Status chips"). */
export function StatusChip({ status }: { status: Status | 'blocked' }) {
  const m =
    status === 'blocked'
      ? { icon: '!', label: 'Blocked', soft: 'var(--block-soft)', ink: 'var(--block-ink)' }
      : statusMeta(status);
  return (
    <span className={s.root} data-status={status} style={{ background: m.soft, color: m.ink }}>
      {m.icon} {m.label}
    </span>
  );
}
