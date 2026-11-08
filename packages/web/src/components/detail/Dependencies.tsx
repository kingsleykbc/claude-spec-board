import { useId, type Ref } from 'react';
import type { Spec } from '@specboard/core';
import { ST } from '../../lib/vm';
import s from './sections.module.css';

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
}

const isDone = (x: Spec) => x.archived || x.status === 'done';

function DepItem({ spec, onOpen, showNotDone }: { spec: Spec; onOpen: (id: string) => void; showNotDone: boolean }) {
  const st = ST[spec.archived ? 'done' : spec.status];
  return (
    <li>
      <button type="button" className={s.dep} onClick={() => onOpen(spec.id)}>
        <span className={s.depId}>{spec.id}</span>
        <span className={s.depTitle}>{spec.title}</span>
        <span className={s.chip} style={{ background: st.soft, color: st.ink }}>
          {`${st.icon} ${st.label}`}
        </span>
        {showNotDone && !isDone(spec) && <span className={s.notDone} style={{ color: 'var(--block-ink)' }}>Not done</span>}
      </button>
    </li>
  );
}

export function Dependencies({ spec, all, onOpen, sectionRef, highlight = false }: DependenciesProps) {
  const uid = useId();
  const find = (id: string) => all.find((x) => x.id === id);
  const needs = spec.dependsOn.map((id) => ({ id, spec: find(id) }));
  const neededBy = spec.dependents.map(find).filter((x): x is Spec => x !== undefined);
  const needsId = `${uid}-needs`;
  const byId = `${uid}-by`;

  return (
    <section
      ref={sectionRef}
      id={`${spec.id}-dependencies`}
      data-section="dependencies"
      aria-label="Dependencies"
      className={s.section}
      style={{ borderColor: highlight ? 'var(--accent)' : 'var(--line)' }}
    >
      <div className={s.head}>
        <span className={s.label}>DEPENDENCIES</span>
      </div>
      <div className={s.deps}>
        <div className={s.depCol}>
          <span id={needsId} className={s.depHead}>
            ⤴ Depends on
          </span>
          {needs.length > 0 ? (
            <ul className={s.depList} aria-labelledby={needsId}>
              {needs.map((d) =>
                d.spec ? (
                  <DepItem key={d.id} spec={d.spec} onOpen={onOpen} showNotDone />
                ) : (
                  <li key={d.id}>
                    <span className={`${s.dep} ${s.missingDep}`}>
                      <span className={s.depId}>{d.id}</span>
                      <span className={s.depTitle} />
                      <span className={s.notDone} style={{ color: 'var(--block-ink)' }}>
                        Not found
                      </span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <span className={s.depEmpty}>Nothing. This spec can start any time.</span>
          )}
        </div>
        <div className={s.depCol}>
          <span id={byId} className={s.depHead}>
            ⤵ Needed by
          </span>
          {neededBy.length > 0 ? (
            <ul className={s.depList} aria-labelledby={byId}>
              {neededBy.map((x) => (
                <DepItem key={x.id} spec={x} onOpen={onOpen} showNotDone={false} />
              ))}
            </ul>
          ) : (
            <span className={s.depEmpty}>No other spec waits on this one.</span>
          )}
        </div>
      </div>
    </section>
  );
}
