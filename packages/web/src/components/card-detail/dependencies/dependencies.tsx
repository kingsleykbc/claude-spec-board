import { useId, type Ref } from 'react';
import type { Spec } from '@specboard/core';
import { NeededByIcon, NeedsIcon } from '@/lib/icons';
import { ST } from '@/lib/vm';
import { cn } from '@/lib/utils';
import { section, sectionHead, sectionLabel } from '../section';

// Dependencies (prototype lines 220-236, view-model line 677 and 701).

export interface DependenciesProps {
  spec: Spec;
  /** Active and archived specs; archived ones count as done. */
  all: Spec[];
  /** Open that spec (`?spec=<id>`). */
  onOpen: (id: string) => void;
  sectionRef?: Ref<HTMLElement>;
  /** Accent border (the blocked banner's scroll target). */
  highlight?: boolean;
  /** Without the section frame, the two lists stacked: for the Simple mode ⋯ popover. */
  compact?: boolean;
}

const isDone = (x: Spec) => x.archived || x.status === 'done';

const row = 'flex w-[calc(100%+16px)] min-w-0 items-center gap-2 rounded-[7px] border-0 bg-transparent -mx-2 px-2 py-[7px] text-left text-fg';
const depId = 'font-mono text-[12px] text-fg2';
const depTitle = 'min-w-0 flex-1 overflow-hidden text-[13.5px] text-ellipsis whitespace-nowrap';
const flag = 'text-[11.5px] font-semibold whitespace-nowrap text-block-ink';
const list = 'm-0 flex list-none flex-col gap-1.5 p-0';
const head = 'inline-flex items-center gap-[5px] text-[12px] font-medium text-fg3';
const empty = 'text-[13px] text-fg3';

function DepItem({ spec, onOpen, showNotDone }: { spec: Spec; onOpen: (id: string) => void; showNotDone: boolean }) {
  const st = ST[spec.archived ? 'done' : spec.status];
  return (
    <li>
      <button type="button" className={cn(row, 'cursor-pointer hover:bg-panel')} onClick={() => onOpen(spec.id)}>
        <span className={depId}>{spec.id}</span>
        <span className={depTitle}>{spec.title}</span>
        <span
          className="inline-flex items-center gap-[5px] rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap"
          style={{ background: st.soft, color: st.ink }}
        >
          <st.icon aria-hidden /> {st.label}
        </span>
        {showNotDone && !isDone(spec) && <span className={flag}>Not done</span>}
      </button>
    </li>
  );
}

export function Dependencies({ spec, all, onOpen, sectionRef, highlight = false, compact = false }: DependenciesProps) {
  const uid = useId();
  const find = (id: string) => all.find((x) => x.id === id);
  const needs = spec.dependsOn.map((id) => ({ id, spec: find(id) }));
  const neededBy = spec.dependents.map(find).filter((x): x is Spec => x !== undefined);
  const needsId = `${uid}-needs`;
  const byId = `${uid}-by`;
  const col = compact ? 'flex flex-col gap-1.5' : 'flex flex-col gap-1.5 px-4 pt-3 pb-3.5';

  return (
    <section
      ref={sectionRef}
      id={`${spec.id}-dependencies`}
      data-section="dependencies"
      data-highlight={compact ? undefined : highlight}
      aria-label="Dependencies"
      className={compact ? 'self-stretch' : section}
    >
      {!compact && (
        <div className={sectionHead}>
          <span className={sectionLabel}>DEPENDENCIES</span>
        </div>
      )}
      <div className={compact ? 'flex flex-col gap-2.5' : 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'}>
        <div className={col}>
          <span id={needsId} className={head}>
            <NeedsIcon aria-hidden /> Depends on
          </span>
          {needs.length > 0 ? (
            <ul className={list} aria-labelledby={needsId}>
              {needs.map((d) =>
                d.spec ? (
                  <DepItem key={d.id} spec={d.spec} onOpen={onOpen} showNotDone />
                ) : (
                  <li key={d.id}>
                    <span className={cn(row, 'cursor-default')}>
                      <span className={depId}>{d.id}</span>
                      <span className={depTitle} />
                      <span className={flag}>Not found</span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <span className={empty}>Nothing. This spec can start any time.</span>
          )}
        </div>
        <div className={cn(col, !compact && 'border-l border-line')}>
          <span id={byId} className={head}>
            <NeededByIcon aria-hidden /> Needed by
          </span>
          {neededBy.length > 0 ? (
            <ul className={list} aria-labelledby={byId}>
              {neededBy.map((x) => (
                <DepItem key={x.id} spec={x} onOpen={onOpen} showNotDone={false} />
              ))}
            </ul>
          ) : (
            <span className={empty}>No other spec waits on this one.</span>
          )}
        </div>
      </div>
    </section>
  );
}
