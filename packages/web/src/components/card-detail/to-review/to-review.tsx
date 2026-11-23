import { useRef, useState } from 'react';
import type { ReviewItem, Spec } from '@specboard/core';
import { api, ConflictError } from '@/api/client';
import { OFFLINE_TOAST, type Mutate } from '@/state/actions';
import type { PushToast } from '@/state/toasts';
import { cn } from '@/lib/utils';
import { section, sectionHead, sectionLabel } from '../section';

// The To review checklist: person-only checks after the work. Ticking one never moves the card.

export type ReviewClient = Pick<typeof api, 'setReview'>;

export interface ToReviewProps {
  pid: string;
  spec: Spec;
  client?: ReviewClient;
  mutate: Mutate;
  refresh: () => Promise<void>;
  toast: PushToast;
  down?: boolean;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The items in file order, split into runs under the same heading (a null group, with no heading, comes first). */
export function groupReviews(items: ReviewItem[]): { group: string | null; items: ReviewItem[] }[] {
  const out: { group: string | null; items: ReviewItem[] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.group === it.group) last.items.push(it);
    else out.push({ group: it.group, items: [it] });
  }
  return out;
}

export function ToReview({ pid, spec, client = api, mutate, refresh, toast, down = false }: ToReviewProps) {
  const id = spec.id;
  const readOnly = spec.archived;
  /** Optimistic ticks while writes are in flight. */
  const [local, setLocal] = useState<Record<number, boolean>>({});
  const inFlight = useRef(0);
  if (spec.reviews.length === 0) return null;

  const items = spec.reviews.map((r) => ({ ...r, done: local[r.n] ?? r.done }));
  const done = items.filter((r) => r.done).length;

  const toggle = async (n: number, next: boolean) => {
    if (readOnly) return;
    if (down) return toast('err', ...OFFLINE_TOAST);
    setLocal((l) => ({ ...l, [n]: next }));
    inFlight.current += 1;
    try {
      await mutate(id, spec.hash, (h) => client.setReview(pid, id, n, h, next));
    } catch (e) {
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
    <section data-section="to-review" aria-label="To review" className={section}>
      <div className={cn(sectionHead, 'gap-3')}>
        <span className={sectionLabel}>TO REVIEW</span>
        <span className="flex-1" />
        <span className="text-[12.5px] text-fg2">{`${done} of ${items.length} checked`}</span>
      </div>
      <div className="flex flex-col">
        {groupReviews(items).map((g, gi) => (
          <div key={gi} role="group" {...(g.group !== null ? { 'aria-label': g.group } : {})}>
            {g.group !== null && <h3 className="m-0 border-b border-line bg-bg px-4 py-2 text-[12.5px] font-semibold text-fg2">{g.group}</h3>}
            {g.items.map((r) => {
              const inputId = `rv-${id}-${r.n}`;
              return (
                <div key={r.n} data-review={r.n} className="flex items-start gap-3 border-b border-line px-4 py-2.5">
                  <input
                    type="checkbox"
                    id={inputId}
                    className="m-0 mt-[3px] size-[17px] flex-none cursor-pointer p-0 disabled:cursor-default"
                    aria-describedby={r.expected !== null ? `${inputId}-exp` : undefined}
                    checked={r.done}
                    disabled={readOnly}
                    onChange={() => void toggle(r.n, !r.done)}
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={inputId} className={cn('block text-[14px]', readOnly ? 'cursor-default' : 'cursor-pointer', r.done ? 'text-fg2' : 'text-fg')}>
                      {r.text}
                    </label>
                    {r.expected !== null && <p id={`${inputId}-exp`} className="m-0 mt-0.5 text-[12.5px] text-fg3">Expected: {r.expected}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
