import type { Urgency } from '@specboard/core';
import { catColor, urgVm } from '../lib/vm';
import { filterChips, NO_FILTERS, toggle, type Filters, type WaitItem } from '../state/filters';
import s from './FilterBar.module.css';

export type FilterMenu = 'cat' | 'urg' | null;
const URG_ORDER: Urgency[] = ['urgent', 'high', 'normal', 'low'];

export interface FilterBarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  /** Every category with its count of live specs. */
  categories: { name: string; n: number }[];
  waits: WaitItem[];
  onWait: (w: WaitItem) => void;
  menu: FilterMenu;
  onMenu: (m: FilterMenu) => void;
}

/** Category / Urgency / Blocked only, active chips, and the "waiting" items (prototype lines 62-87; pinned behaviours 3 and 4). */
export function FilterBar({ filters: f, onChange, categories, waits, onWait, menu, onMenu }: FilterBarProps) {
  const chips = filterChips(f);
  return (
    <div className={s.bar}>
      <div className={s.wrap}>
        <button type="button" className={s.btn} aria-expanded={menu === 'cat'} onClick={() => onMenu(menu === 'cat' ? null : 'cat')}>
          Category{f.cats.length > 0 && <span className={s.n}>{f.cats.length}</span>}
          <span className={s.caret}>▾</span>
        </button>
        {menu === 'cat' && (
          <div className={s.pop} style={{ width: 200 }}>
            {categories.map((o) => (
              <label key={o.name} className={s.opt}>
                <input type="checkbox" checked={f.cats.includes(o.name)} onChange={() => onChange({ ...f, cats: toggle(f.cats, o.name) })} />
                <span className={s.dot} style={{ background: catColor(o.name) }} />
                {o.name}
                <span className={s.optN}>{o.n}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className={s.wrap}>
        <button type="button" className={s.btn} aria-expanded={menu === 'urg'} onClick={() => onMenu(menu === 'urg' ? null : 'urg')}>
          Urgency{f.urg.length > 0 && <span className={s.n}>{f.urg.length}</span>}
          <span className={s.caret}>▾</span>
        </button>
        {menu === 'urg' && (
          <div className={s.pop} style={{ width: 190 }}>
            {URG_ORDER.map((k) => {
              const u = urgVm(k);
              return (
                <label key={k} className={s.opt}>
                  <input type="checkbox" checked={f.urg.includes(k)} onChange={() => onChange({ ...f, urg: toggle(f.urg, k) })} />
                  <span className={s.bars}>
                    {u.bars.map((b, i) => (
                      <span key={i} style={{ height: b.h, background: b.c }} />
                    ))}
                  </span>
                  <span style={{ color: u.fg, fontWeight: u.weight }}>{u.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
      <button type="button" role="switch" aria-checked={f.blocked} className={`${s.btn} ${s.switch}`} onClick={() => onChange({ ...f, blocked: !f.blocked })}>
        <span className={s.track} style={{ background: f.blocked ? 'var(--accent)' : 'var(--line2)' }}>
          <span className={s.knob} style={{ left: f.blocked ? 13 : 2 }} />
        </span>
        Blocked only
      </button>
      {chips.length > 0 && (
        <>
          <span className={s.sep} />
          {chips.map((ch) => (
            <span key={ch.prefix + ch.label} className={s.chip}>
              {ch.prefix && <span className={s.prefix}>{ch.prefix}</span>}
              {ch.label}
              <button type="button" aria-label="Remove filter" className={s.x} onClick={() => onChange(ch.without)}>
                ×
              </button>
            </span>
          ))}
          <button type="button" className={s.clear} onClick={() => onChange(NO_FILTERS)}>
            Clear
          </button>
        </>
      )}
      <div className={s.flex} />
      <div className={s.waits}>
        {waits.map((w) => (
          <button key={w.kind} type="button" className={s.wait} onClick={() => onWait(w)}>
            <span className={s.diamond} style={{ background: w.kind === 'blocked' ? 'var(--block)' : 'var(--review)' }} />
            {w.text}
          </button>
        ))}
      </div>
    </div>
  );
}
