import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Spec, Status } from '@specboard/core';
import { ST } from '@/lib/vm';
import { cn } from '@/lib/utils';

export const EMPTY_TEXT: Record<Status, string> = {
  todo: 'Nothing to do',
  doing: 'Nothing in progress',
  review: 'Nothing waiting on you',
  done: 'Nothing done yet',
};

/** Each status's icon colour (the same inks as `ST`). */
const INK: Record<Status, string> = {
  todo: 'text-fg2',
  doing: 'text-doing-ink',
  review: 'text-review-ink',
  done: 'text-done-ink',
};

export interface ColumnProps {
  status: Status;
  /** Cards to show, in order. */
  specs: Spec[];
  /** Where the drop placeholder goes (index into `specs`), or null for none. */
  placeholderAt: number | null;
  /** A card from another column is over this one. */
  over: boolean;
  /** Archived specs the Done column would show under the current filters; the toggle shows only when > 0. */
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
      <div
        key="__ph"
        className="flex h-[110px] items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-accent bg-card text-[12.5px] font-medium text-accent-ink"
      >
        Drop to move to {st.label}
      </div>,
    );
  }
  return (
    <section
      ref={setNodeRef}
      aria-label={st.label}
      data-over={over || undefined}
      className={cn(
        // Wide: a grid cell as tall as the window allows. Up to 1100px: a 300px slide in the sideways scroll.
        'flex min-h-[calc(100vh-154px)] flex-col gap-2 rounded-xl p-2 outline-[1.5px] -outline-offset-[1.5px] transition-[background] duration-150',
        'max-[1100px]:max-h-[calc(100vh-154px)] max-[1100px]:flex-[0_0_300px] max-[1100px]:snap-start max-[1100px]:overflow-y-auto',
        over ? 'bg-accent-soft outline-dashed outline-accent' : cn('outline-solid outline-transparent', status === 'review' ? 'bg-review-soft' : 'bg-panel'),
      )}
    >
      <div className="flex min-h-[30px] items-center gap-2 px-1.5 pt-1 pb-1.5">
        <span className={cn('inline-flex w-3.5 justify-center text-[13px]', INK[status])}>
          <st.icon aria-hidden />
        </span>
        <span className="text-[13px] font-semibold">{st.label}</span>
        <span className="font-mono text-xs text-fg3">{specs.length}</span>
        {status === 'review' && specs.length > 0 && <span className="ml-0.5 text-[11.5px] font-semibold text-review-ink">Needs you</span>}
        <span className="flex-1" />
        {status === 'done' && archivedCount > 0 && (
          <button
            type="button"
            className="cursor-pointer rounded-[5px] border-0 bg-transparent px-1 py-0.5 text-xs whitespace-nowrap text-fg3 hover:bg-line hover:text-fg"
            onClick={onToggleArchived}
          >
            {showArchived ? `Hide archived (${archivedCount})` : `Show archived (${archivedCount})`}
          </button>
        )}
      </div>
      {items}
      {items.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-line2 px-3 py-[22px] text-center text-[12.5px] text-fg3">{EMPTY_TEXT[status]}</div>
      )}
    </section>
  );
}
