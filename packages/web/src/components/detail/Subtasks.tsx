import { useRef, useState } from 'react';
import type { Spec } from '@specboard/core';
// Subpath import: the core index pulls in node:crypto, which the browser build cannot load.
import { youStep } from '@specboard/core/you';
import { api, ConflictError } from '../../api/client';
import { OFFLINE_TOAST, type Mutate } from '../../state/actions';
import type { PushToast } from '../../state/toasts';
import { Spinner } from '../ConnectionBanner';
import { CaretIcon, CaretUpIcon, LogIcon } from '../../lib/icons';
import { SubtaskLog } from './SubtaskLog';
import s from './sections.module.css';

// Subtasks with the inline log (prototype lines 238-261, view-model lines 702-705; pinned behaviours 10 and 13).

export type SubtaskClient = Pick<typeof api, 'setSubtask'>;

export interface SubtasksProps {
  pid: string;
  spec: Spec;
  client?: SubtaskClient;
  /** The per-spec mutator: rapid ticks chain hashes (Review Focus 3). */
  mutate: Mutate;
  refresh: () => Promise<void>;
  toast: PushToast;
  down?: boolean;
  /** Keys changed by the last live update; `${id}:${n}` rows flash. */
  changed?: ReadonlySet<string>;
  /** A run is working on this spec: the current subtask shows "In progress". */
  runActive?: boolean;
}

const NONE: ReadonlySet<string> = new Set();
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Subtasks({ pid, spec, client = api, mutate, refresh, toast, down = false, changed = NONE, runActive = false }: SubtasksProps) {
  const id = spec.id;
  /** Optimistic ticks while writes are in flight. */
  const [local, setLocal] = useState<Record<number, boolean>>({});
  const inFlight = useRef(0);
  const [openLog, setOpenLog] = useState<number | null>(null);

  const subtasks = spec.subtasks.map((t) => ({ ...t, done: local[t.n] ?? t.done }));
  const done = subtasks.filter((t) => t.done).length;
  const total = subtasks.length;
  const complete = total > 0 && done === total;

  const toggle = async (n: number, next: boolean) => {
    if (down) return toast('err', ...OFFLINE_TOAST);
    setLocal((l) => ({ ...l, [n]: next }));
    inFlight.current += 1;
    try {
      await mutate(id, spec.hash, (h) => client.setSubtask(pid, id, n, h, next));
    } catch (e) {
      // Revert this tick; the others in the queue keep theirs.
      setLocal((l) => {
        const rest = { ...l };
        delete rest[n];
        return rest;
      });
      if (e instanceof ConflictError) toast('err', `Couldn’t update ${id}`, 'The file changed. Try again.');
      else toast('err', `Couldn’t update ${id}`, message(e));
    }
    await refresh();
    inFlight.current -= 1;
    if (inFlight.current === 0) setLocal({});
  };

  return (
    <section data-section="subtasks" aria-label="Subtasks" className={s.section}>
      <div className={`${s.head} ${s.headWide}`}>
        <span className={s.label}>SUBTASKS</span>
        <span className={s.grow} />
        <span className={s.stText}>{total > 0 ? `${done} of ${total} done` : ''}</span>
        <div className={s.track}>
          <div
            data-testid="subtask-bar"
            className={s.fill}
            style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : '0%', background: complete ? 'var(--done)' : 'var(--fg2)' }}
          />
        </div>
      </div>
      {total === 0 && <div className={s.empty}>No subtasks yet. Claude adds them when it writes up the spec.</div>}
      <div className={s.list}>
        {subtasks.map((t) => {
          const key = `${id}:${t.n}`;
          const inputId = `st-${key}`;
          const you = youStep(t.title);
          const log = spec.logs?.[t.n];
          const open = openLog === t.n && log !== undefined;
          return (
            <div
              key={t.n}
              data-subtask={t.n}
              className={s.stRow}
              style={{ background: changed.has(key) ? 'var(--accent-soft)' : 'transparent' }}
            >
              <div className={s.stLine}>
                <input
                  type="checkbox"
                  id={inputId}
                  className={s.check}
                  checked={t.done}
                  onChange={() => void toggle(t.n, !t.done)}
                />
                <label htmlFor={inputId} className={s.stName} style={{ color: t.done ? 'var(--fg2)' : 'var(--fg)' }}>
                  {you !== null && (
                    <span data-testid="you-tag" className={s.you} title="Your step: Claude never ticks it">
                      you
                    </span>
                  )}
                  {you ?? t.title}
                </label>
                {runActive && spec.currentSubtask === t.n && (
                  <span className={s.active}>
                    <Spinner />
                    In progress
                  </span>
                )}
                {log !== undefined && (
                  <button type="button" className={s.logBtn} aria-expanded={open} onClick={() => setOpenLog(open ? null : t.n)}>
                    <LogIcon aria-hidden className={s.logIcon} />
                    Log
                    {open ? <CaretUpIcon aria-hidden className={s.caret} /> : <CaretIcon aria-hidden className={s.caret} />}
                  </button>
                )}
              </div>
              {open && <SubtaskLog log={log} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
