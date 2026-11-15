import type { Status } from '@specboard/core';
import { ErrorIcon } from '@/lib/icons';
import { statusMeta } from '@/lib/vm';

/** Status pill (To-do, Doing, Review, Done) or the Blocked pill (prototype "Status chips"). */
export function StatusChip({ status }: { status: Status | 'blocked' }) {
  const m =
    status === 'blocked'
      ? { icon: ErrorIcon, label: 'Blocked', soft: 'var(--block-soft)', ink: 'var(--block-ink)' }
      : statusMeta(status);
  // The colours come from the status, so they stay inline.
  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[12px] font-semibold"
      data-status={status}
      style={{ background: m.soft, color: m.ink }}
    >
      <m.icon aria-hidden /> {m.label}
    </span>
  );
}
