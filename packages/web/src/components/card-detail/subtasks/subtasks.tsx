import { useRef, useState } from 'react';
import type { Spec } from '@specboard/core';
// Subpath import: the core index pulls in node:crypto, which the browser build cannot load.
import { youStep } from '@specboard/core/you';
import { api, ConflictError } from '@/api/client';
import { OFFLINE_TOAST, type Mutate } from '@/state/actions';
import type { PushToast } from '@/state/toasts';
import { Spinner } from '@/components/connection-banner/connection-banner';
import { CaretIcon, CaretUpIcon, LogIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { SubtaskLog } from '../subtask-log/subtask-log';
import { section, sectionHead, sectionLabel } from '../section';

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
    <section data-section="subtasks" aria-label="Subtasks" className={section}>
      <div className={cn(sectionHead, 'gap-3')}>
        <span className={sectionLabel}>SUBTASKS</span>
        <span className="flex-1" />
        <span className="text-[12.5px] text-fg2">{total > 0 ? `${done} of ${total} done` : ''}</span>
        <div className="h-[5px] w-20 overflow-hidden rounded-full bg-line">
          <div
            data-testid="subtask-bar"
            data-complete={complete}
            className="h-full rounded-full bg-fg2 transition-[width] duration-500 data-[complete=true]:bg-done"
            style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : '0%' }}
          />
        </div>
      </div>
      {total === 0 && <div className="px-4 py-[18px] text-[13.5px] text-fg3">No subtasks yet. Claude adds them when it writes up the spec.</div>}
      <div className="flex flex-col">
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
              data-changed={changed.has(key)}
              className="border-b border-line bg-transparent transition-[background] duration-[800ms] data-[changed=true]:bg-accent-soft"
            >
              <div className="flex min-h-[46px] items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  id={inputId}
                  className="m-0 size-[17px] flex-none cursor-pointer p-0"
                  checked={t.done}
                  onChange={() => void toggle(t.n, !t.done)}
                />
                <label htmlFor={inputId} className={cn('min-w-0 flex-1 cursor-pointer text-[14px]', t.done ? 'text-fg2' : 'text-fg')}>
                  {you !== null && (
                    <span data-testid="you-tag" className="mr-2 inline-block rounded-full border border-review bg-review-soft px-[7px] py-px text-[11px] leading-[1.5] font-semibold text-review-ink" title="Your step: Claude never ticks it">
                      you
                    </span>
                  )}
                  {you ?? t.title}
                </label>
                {runActive && spec.currentSubtask === t.n && (
                  <span className="inline-flex items-center gap-[7px] rounded-full bg-doing-soft px-[9px] py-[3px] text-[12px] font-medium text-doing-ink">
                    <Spinner />
                    In progress
                  </span>
                )}
                {log !== undefined && (
                  <button type="button" className="flex h-[26px] cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-[9px] py-0 text-[12.5px] text-fg2 hover:bg-panel hover:text-fg aria-expanded:bg-panel" aria-expanded={open} onClick={() => setOpenLog(open ? null : t.n)}>
                    <LogIcon aria-hidden className="text-[14px]" />
                    Log
                    {open ? <CaretUpIcon aria-hidden className="text-[12px]" /> : <CaretIcon aria-hidden className="text-[12px]" />}
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
