import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Spec, Status } from '@specboard/core';
import { ST } from '../lib/vm';
import s from './Board.module.css';

export const EMPTY_TEXT: Record<Status, string> = {
  todo: 'Nothing to do',
  doing: 'Nothing in progress',
  review: 'Nothing waiting on you',
  done: 'Nothing done yet',
};

export interface ColumnProps {
  status: Status;
  /** Cards to show, in order. */
  specs: Spec[];
  /** Where the drop placeholder goes (index into `specs`), or null for none. */
  placeholderAt: number | null;
  /** A card from another column is over this one. */
  over: boolean;
  /** Archived specs in the project (Done column only shows the toggle when > 0). */
  archivedCount?: number;
  showArchived?: boolean;
  onToggleArchived?: () => void;
  renderCard: (spec: Spec) => ReactNode;
}

/** One board column (prototype lines 90-107); a dnd-kit drop target keyed by its status. */
export function Column({ status, specs, placeholderAt, over, archivedCount = 0, showArchived = false, onToggleArchived, renderCard }: ColumnProps) {
  const st = ST[status];
  const { setNodeRef } = useDroppable({ id: status });
  const items: ReactNode[] = specs.map((x) => renderCard(x));
  if (placeholderAt !== null) {
    items.splice(
      placeholderAt,
      0,
      <div key="__ph" className={s.ph}>
        Drop to move to {st.label}
      </div>,
    );
  }
  return (
    <section
      ref={setNodeRef}
      aria-label={st.label}
      className={s.col}
      style={{
        background: over ? 'var(--accent-soft)' : status === 'review' ? 'var(--review-soft)' : 'var(--panel)',
        // Longhands: the prototype's 1.5px dashed var(--accent) / 1.5px solid transparent.
        outlineWidth: '1.5px',
        outlineStyle: over ? 'dashed' : 'solid',
        outlineColor: over ? 'var(--accent)' : 'transparent',
      }}
    >
      <div className={s.head}>
        <span className={s.icon} style={{ color: st.ink }}>
          <st.icon aria-hidden />
        </span>
        <span className={s.label}>{st.label}</span>
        <span className={s.count}>{specs.length}</span>
        {status === 'review' && specs.length > 0 && <span className={s.needs}>Needs you</span>}
        <span className={s.spacer} />
        {status === 'done' && archivedCount > 0 && (
          <button type="button" className={s.arch} onClick={onToggleArchived}>
            {showArchived ? `Hide archived (${archivedCount})` : `Show archived (${archivedCount})`}
          </button>
        )}
      </div>
      {items}
      {items.length === 0 && <div className={s.empty}>{EMPTY_TEXT[status]}</div>}
    </section>
  );
}
