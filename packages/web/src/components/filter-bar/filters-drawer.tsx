import { useId, type ReactNode } from 'react';
import { LuSlidersHorizontal } from 'react-icons/lu';
import { NO_FILTERS, toggle, type Filters } from '@/state/filters';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer/drawer';
import { Switch } from '@/components/ui/switch/switch';
import { CategoryLabel, CountBadge, filterButton, UrgencyLabel, URG_ORDER } from './filter-options';

/** How many filters are on: each chosen category and urgency counts 1, and Blocked only counts 1. The milestone does not count. */
export function activeFilterCount(f: Filters): number {
  return f.cats.length + f.urg.length + (f.blocked ? 1 : 0);
}

export interface FiltersDrawerProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  /** Every category with its count of live specs. */
  categories: { name: string; n: number }[];
}

const row = 'flex cursor-pointer items-center gap-[9px] rounded-[7px] px-2.5 py-2.5 text-[14px] text-fg hover:bg-panel';
const box = 'm-0 size-[15px] flex-none cursor-pointer accent-accent';

/** A titled group of controls in the drawer. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col">
      <div id={id} className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-fg3 uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * Narrow screens: one "Filters" button (with a badge counting the active filters) that opens a bottom drawer
 * holding Category, Urgency and Blocked only, plus "Clear filters". It is a panel of controls, not a menu:
 * ticking a box changes the filters at once and the drawer stays open.
 */
export function FiltersDrawer({ filters: f, onChange, categories }: FiltersDrawerProps) {
  const n = activeFilterCount(f);
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button type="button" aria-label={n ? `Filters, ${n} active` : 'Filters'} className={filterButton}>
          <LuSlidersHorizontal aria-hidden="true" className="size-3.5 flex-none text-fg3" />
          Filters
          {n > 0 && <CountBadge n={n} />}
        </button>
      </DrawerTrigger>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader className="pb-1">
          <DrawerTitle>Filters</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-2 overflow-y-auto px-2">
          <Section title="Category">
            {categories.map((o) => (
              <label key={o.name} className={row}>
                <input type="checkbox" className={box} checked={f.cats.includes(o.name)} onChange={() => onChange({ ...f, cats: toggle(f.cats, o.name) })} />
                <CategoryLabel name={o.name} n={o.n} />
              </label>
            ))}
          </Section>
          <Section title="Urgency">
            {URG_ORDER.map((k) => (
              <label key={k} className={row}>
                <input type="checkbox" className={box} checked={f.urg.includes(k)} onChange={() => onChange({ ...f, urg: toggle(f.urg, k) })} />
                <UrgencyLabel level={k} />
              </label>
            ))}
          </Section>
          <label className={`${row} justify-between`}>
            Blocked only
            <Switch checked={f.blocked} onCheckedChange={(on) => onChange({ ...f, blocked: on })} />
          </label>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={n === 0}
            className="cursor-pointer rounded-md border-0 bg-transparent px-1 py-1.5 font-[inherit] text-[14px] font-medium text-accent-ink disabled:cursor-default disabled:text-fg3"
            onClick={() => onChange({ ...NO_FILTERS, milestone: f.milestone })}
          >
            Clear filters
          </button>
          <DrawerClose asChild>
            <button type="button" className="cursor-pointer rounded-lg border-0 bg-fg px-4 py-2 font-[inherit] text-[14px] font-medium text-bg">
              Done
            </button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
