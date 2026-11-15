import { LuKanban, LuTable2 } from 'react-icons/lu';
import { CaretIcon, CloseIcon, MoreIcon } from '@/lib/icons';
import { useNarrow } from '@/lib/useNarrow';
import { cn } from '@/lib/utils';
import { filterChips, NO_FILTERS, toggle, type Filters, type MilestoneOption, type WaitItem } from '@/state/filters';
import type { View } from '@/state/viewMode';
import { Hint } from '@/components/ui/hint/hint';
import { ResponsiveMenu, ResponsiveMenuItem } from '@/components/ui/responsive-menu/responsive-menu';
import { Switch } from '@/components/ui/switch/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group/toggle-group';
import { CategoryLabel, CountBadge, filterButton, UrgencyLabel, URG_ORDER } from './filter-options';
import { FiltersDrawer } from './filters-drawer';
import { MilestonePicker } from './milestone-picker';

export interface FilterBarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  /** Every category with its count of live specs. */
  categories: { name: string; n: number }[];
  waits: WaitItem[];
  onWait: (w: WaitItem) => void;
  /** Simple mode (switched in the top bar): the waiting items move behind a ⋯ menu. */
  simple?: boolean;
  /** Board or Table; the switch shows when `onView` is given. */
  view?: View;
  onView?: (v: View) => void;
  /** The milestone picker's options (empty or missing: no picker). Shown in the Board view only. */
  milestones?: MilestoneOption[];
}

const VIEWS = [
  { v: 'board', label: 'Board view', Icon: LuKanban },
  { v: 'table', label: 'Table view', Icon: LuTable2 },
] as const;

/** Board | Table as icon-only toggles with tooltips: a radio group, arrow keys move between them. */
function ViewSwitch({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      aria-label="View"
      data-tour="view"
      value={view}
      // Clicking the chosen one again would clear the value; the view always has one.
      onValueChange={(v) => v && onView(v as View)}
      className="h-[30px]"
    >
      {VIEWS.map(({ v, label, Icon }) => (
        // The toggle is the outer asChild and Hint the inner wrapper, so the toggle's data-state wins (see Hint).
        <ToggleGroupItem key={v} value={v} asChild className="w-[30px] text-fg3">
          <Hint label={label}>
            <button type="button" aria-label={label}>
              <Icon aria-hidden="true" className="size-[15px]" />
            </button>
          </Hint>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const diamond = (w: WaitItem) => <span className={cn('size-[7px] flex-none rotate-45 rounded-[2px]', w.kind === 'blocked' ? 'bg-block' : 'bg-review')} />;

/**
 * View switch, milestone picker, Category / Urgency / Blocked only, active chips, and the "waiting" items
 * (prototype lines 62-87; pinned behaviours 3 and 4). On narrow screens Category, Urgency and Blocked only
 * sit in one "Filters" drawer.
 */
export function FilterBar({ filters: f, onChange, categories, waits, onWait, simple = false, view = 'board', onView, milestones = [] }: FilterBarProps) {
  const narrow = useNarrow();
  const chips = filterChips(f);
  return (
    <div
      data-tour="filters"
      className={cn(
        'relative z-[28] flex items-center gap-2',
        // Small screens: one row that scrolls sideways.
        narrow ? 'flex-nowrap overflow-x-auto px-3 pt-3 pb-2.5 [scrollbar-width:none] *:flex-none' : 'flex-wrap px-5 pt-3 pb-2.5',
      )}
    >
      {onView && <ViewSwitch view={view} onView={onView} />}
      {milestones.length > 0 && view === 'board' && <MilestonePicker options={milestones} value={f.milestone} onChange={(m) => onChange({ ...f, milestone: m })} />}
      {narrow ? (
        <FiltersDrawer filters={f} onChange={onChange} categories={categories} />
      ) : (
        <>
          <ResponsiveMenu
            title="Category"
            contentClassName="w-[200px]"
            trigger={
              <button type="button" className={filterButton}>
                Category{f.cats.length > 0 && <CountBadge n={f.cats.length} />}
                <CaretIcon aria-hidden className="text-[12px] text-fg3" />
              </button>
            }
          >
            {categories.map((o) => (
              <ResponsiveMenuItem key={o.name} keepOpen checked={f.cats.includes(o.name)} onSelect={() => onChange({ ...f, cats: toggle(f.cats, o.name) })}>
                <CategoryLabel name={o.name} n={o.n} />
              </ResponsiveMenuItem>
            ))}
          </ResponsiveMenu>
          <ResponsiveMenu
            title="Urgency"
            contentClassName="w-[190px]"
            trigger={
              <button type="button" className={filterButton}>
                Urgency{f.urg.length > 0 && <CountBadge n={f.urg.length} />}
                <CaretIcon aria-hidden className="text-[12px] text-fg3" />
              </button>
            }
          >
            {URG_ORDER.map((k) => (
              <ResponsiveMenuItem key={k} keepOpen checked={f.urg.includes(k)} onSelect={() => onChange({ ...f, urg: toggle(f.urg, k) })}>
                <UrgencyLabel level={k} />
              </ResponsiveMenuItem>
            ))}
          </ResponsiveMenu>
          <label className={cn(filterButton, 'gap-2 pl-2')}>
            <Switch checked={f.blocked} onCheckedChange={(on) => onChange({ ...f, blocked: on })} />
            Blocked only
          </label>
        </>
      )}
      {chips.length > 0 && (
        <>
          <span className="mx-1 h-[18px] w-px bg-line" />
          {chips.map((ch) => (
            <span
              key={ch.prefix + ch.label}
              className="inline-flex h-[26px] items-center gap-1 rounded-full border border-line bg-panel py-0 pr-1 pl-[9px] text-[12.5px] whitespace-nowrap"
            >
              {ch.prefix && <span className="text-fg3">{ch.prefix}</span>}
              {ch.label}
              <button
                type="button"
                aria-label="Remove filter"
                className="inline-flex size-[18px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-[13px] leading-none text-fg3 hover:bg-line hover:text-fg"
                onClick={() => onChange(ch.without)}
              >
                <CloseIcon aria-hidden />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent px-1 py-0 font-[inherit] text-[12.5px] font-medium text-accent-ink"
            onClick={() => onChange({ ...NO_FILTERS, milestone: f.milestone })}
          >
            Clear
          </button>
        </>
      )}
      <div className="flex-1" />
      {simple ? (
        waits.length > 0 && (
          <ResponsiveMenu
            title="Waiting on you"
            align="end"
            contentClassName="min-w-[200px]"
            trigger={
              <Hint label="Waiting on you">
                <button type="button" className={cn(filterButton, 'relative w-[34px] justify-center px-0 text-[16px]')}>
                  <MoreIcon aria-hidden />
                  <span className="absolute top-1 right-1 size-[7px] rounded-full bg-review" />
                </button>
              </Hint>
            }
          >
            {waits.map((w) => (
              <ResponsiveMenuItem key={w.kind} onSelect={() => onWait(w)}>
                {diamond(w)}
                {w.text}
              </ResponsiveMenuItem>
            ))}
          </ResponsiveMenu>
        )
      ) : (
        <div className="flex items-center gap-1">
          {waits.map((w) => (
            <button
              key={w.kind}
              type="button"
              className="flex h-7 cursor-pointer items-center gap-1.5 rounded-[7px] border-0 bg-transparent px-[9px] py-0 font-[inherit] text-[12.5px] whitespace-nowrap text-fg2 hover:bg-panel hover:text-fg"
              onClick={() => onWait(w)}
            >
              {diamond(w)}
              {w.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
