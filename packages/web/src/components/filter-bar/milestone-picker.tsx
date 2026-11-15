import { CaretIcon } from '@/lib/icons';
import type { MilestoneOption } from '@/state/filters';
import {
  ResponsiveMenu,
  ResponsiveMenuRadioGroup,
  ResponsiveMenuRadioItem,
  ResponsiveMenuSeparator,
} from '@/components/ui/responsive-menu/responsive-menu';

/** The radio value of "All milestones" (the filter itself holds null). */
const ALL = '\u0000all';

export interface MilestonePickerProps {
  /** The project's milestones with done/total (from `milestoneOptions`). */
  options: MilestoneOption[];
  /** The chosen milestone's value; null = all milestones. */
  value: string | null;
  onChange: (milestone: string | null) => void;
}

/**
 * The board's milestone filter, styled like the project title: the name in bold, " · done/total", a chevron;
 * no box. Opens a dropdown on wide screens and a bottom drawer on narrow ones, listing each milestone with
 * its count, then "All milestones".
 */
export function MilestonePicker({ options, value, onChange }: MilestonePickerProps) {
  const chosen = value === null ? undefined : options.find((o) => o.value === value);
  const label = value === null ? 'All milestones' : (chosen?.label ?? value);
  const count =
    value === null
      ? options.reduce((n, o) => ({ done: n.done + o.done, total: n.total + o.total }), { done: 0, total: 0 })
      : chosen && { done: chosen.done, total: chosen.total };
  return (
    <ResponsiveMenu
      title="Milestone"
      contentClassName="min-w-[210px]"
      trigger={
        <button
          type="button"
          aria-label={`Milestone: ${label}`}
          className="flex h-[30px] min-w-0 cursor-pointer items-center gap-0 rounded-lg border-0 bg-transparent px-2 py-0 text-[13.5px] whitespace-nowrap text-fg hover:bg-panel"
        >
          <span className="min-w-0 truncate font-semibold">{label}</span>
          {/* whitespace-pre: a flex item would drop the leading space. */}
          {count && <span className="font-normal whitespace-pre text-fg2">{` · ${count.done}/${count.total}`}</span>}
          <CaretIcon aria-hidden className="ml-1.5 flex-none text-[13px] text-fg3" />
        </button>
      }
    >
      <ResponsiveMenuRadioGroup value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        {options.map((o) => (
          <ResponsiveMenuRadioItem key={o.value} value={o.value}>
            {o.label}
            <span className="ml-auto pl-4 text-[12px] text-fg3">
              {o.done}/{o.total}
            </span>
          </ResponsiveMenuRadioItem>
        ))}
        <ResponsiveMenuSeparator />
        <ResponsiveMenuRadioItem value={ALL}>All milestones</ResponsiveMenuRadioItem>
      </ResponsiveMenuRadioGroup>
    </ResponsiveMenu>
  );
}
