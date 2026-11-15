import type { Urgency } from '@specboard/core';
import { catColor, urgVm } from '@/lib/vm';

/** Urgency filter choices, most urgent first. */
export const URG_ORDER: Urgency[] = ['urgent', 'high', 'normal', 'low'];

/** A filter choice's label: the category's colour dot, its name and its count of live specs. */
export function CategoryLabel({ name, n }: { name: string; n: number }) {
  return (
    <>
      {/* The colour comes from the name, so it stays inline. */}
      <span className="size-[7px] flex-none rounded-full" style={{ background: catColor(name) }} />
      {name}
      <span className="ml-auto pl-3 text-[12px] text-fg3">{n}</span>
    </>
  );
}

/** A filter choice's label: the urgency's three bars and its name, coloured by level. */
export function UrgencyLabel({ level }: { level: Urgency }) {
  const u = urgVm(level);
  // Bar heights, colours and weight come from the level, so they stay inline.
  return (
    <>
      <span className="flex h-[11px] flex-none items-end gap-[1.5px]">
        {u.bars.map((b, i) => (
          <span key={i} className="w-[3px] rounded-[1px]" style={{ height: b.h, background: b.c }} />
        ))}
      </span>
      <span style={{ color: u.fg, fontWeight: u.weight }}>{u.label}</span>
    </>
  );
}

/** The count badge on a filter button. */
export function CountBadge({ n }: { n: number }) {
  return (
    <span data-testid="filter-count" className="rounded-full bg-fg px-[5px] text-[11px] font-semibold text-bg">
      {n}
    </span>
  );
}

/** The boxed filter button look (Category, Urgency, Blocked only, Filters). */
export const filterButton =
  'flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-0 font-[inherit] text-[13px] whitespace-nowrap text-fg2 hover:border-line2';
