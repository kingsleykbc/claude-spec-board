import { useRef, useState } from 'react';
import type { ReviewItem, Spec } from '@specboard/core';
import { api, ConflictError } from '@/api/client';
import { ESC, useEscape } from '@/lib/escape';
import { OFFLINE_TOAST, type Mutate } from '@/state/actions';
import type { PushToast } from '@/state/toasts';
import { cn } from '@/lib/utils';
import { section, sectionHead, sectionLabel } from '../section';
import { ReviewSteps } from './review-steps';

// The To review checklist: person-only checks after the work. Ticking one never moves the card. Pass ticks an item;
// Fail saves what went wrong (`> failed:`), which Fix review issues hands to Claude.

export type ReviewClient = Pick<typeof api, 'setReview' | 'setReviewFailed'>;

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

/** A failed reason as it is saved: one line, trimmed. */
export const oneLine = (text: string): string => text.replace(/\s*[\r\n]+\s*/g, ' ').trim();

const smallButton =
  'inline-flex h-[26px] cursor-pointer items-center rounded-[7px] border border-line2 bg-card px-2.5 py-0 text-[12.5px] font-semibold text-fg hover:border-fg3 hover:bg-raise disabled:cursor-default disabled:opacity-50';

type Local = { done?: boolean; failed?: string | null };

export function ToReview({ pid, spec, client = api, mutate, refresh, toast, down = false }: ToReviewProps) {
  const id = spec.id;
  const readOnly = spec.archived;
  /** Optimistic ticks and failed reasons while writes are in flight. */
  const [local, setLocal] = useState<Record<number, Local>>({});
  /** The item whose "What went wrong?" box is open, and its draft. */
  const [editing, setEditing] = useState<{ n: number; text: string } | null>(null);
  const inFlight = useRef(0);
  // Esc closes the box before the card.
  useEscape(editing !== null, () => setEditing(null), ESC.input);
  if (spec.reviews.length === 0) return null;

  const items = spec.reviews.map((r) => {
    const l = local[r.n];
    return { ...r, done: l?.done ?? r.done, failed: l && 'failed' in l ? (l.failed ?? null) : r.failed };
  });
  const done = items.filter((r) => r.done).length;
  const failedCount = items.filter((r) => r.failed !== null).length;

  /** Write one change for item `n`, shown at once and undone if the write fails. */
  const write = async (n: number, next: Local, call: (hash: string) => ReturnType<ReviewClient['setReview']>) => {
    if (readOnly) return;
    if (down) return toast('err', ...OFFLINE_TOAST);
    setLocal((l) => ({ ...l, [n]: { ...l[n], ...next } }));
    inFlight.current += 1;
    try {
      await mutate(id, spec.hash, call);
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

  // Ticking (the checkbox or Pass) also clears a failed reason: the server removes the `> failed:` line.
  const toggle = (n: number, next: boolean) =>
    write(n, next ? { done: true, failed: null } : { done: false }, (h) => client.setReview(pid, id, n, h, next));
  const setFailed = (n: number, reason: string | null) =>
    write(n, reason === null ? { failed: null } : { failed: reason, done: false }, (h) => client.setReviewFailed(pid, id, n, h, reason));

  const save = () => {
    if (!editing) return;
    const reason = oneLine(editing.text);
    if (reason === '') return;
    setEditing(null);
    void setFailed(editing.n, reason);
  };

  return (
    <section data-section="to-review" aria-label="To review" className={section}>
      <div className={cn(sectionHead, 'gap-3')}>
        <span className={sectionLabel}>TO REVIEW</span>
        <span className="flex-1" />
        {failedCount > 0 && <span className="text-[12.5px] font-semibold text-block-ink">{`${failedCount} failed`}</span>}
        <span className="text-[12.5px] text-fg2">{`${done} of ${items.length} checked`}</span>
      </div>
      <div className="flex flex-col">
        {groupReviews(items).map((g, gi) => (
          <div key={gi} role="group" {...(g.group !== null ? { 'aria-label': g.group } : {})}>
            {g.group !== null && <h3 className="m-0 border-b border-line bg-bg px-4 py-2 text-[12.5px] font-semibold text-fg2">{g.group}</h3>}
            {g.items.map((r) => {
              const inputId = `rv-${id}-${r.n}`;
              const failed = r.failed !== null && !r.done;
              const open = editing?.n === r.n;
              const describedBy = [r.expected !== null ? `${inputId}-exp` : null, failed ? `${inputId}-fail` : null].filter(Boolean).join(' ');
              return (
                <div
                  key={r.n}
                  data-review={r.n}
                  data-failed={failed || undefined}
                  className={cn('flex items-start gap-3 border-b border-line px-4 py-2.5', failed && 'bg-block-soft')}
                >
                  <input
                    type="checkbox"
                    id={inputId}
                    className="m-0 mt-[3px] size-[17px] flex-none cursor-pointer p-0 disabled:cursor-default"
                    aria-describedby={describedBy || undefined}
                    checked={r.done}
                    disabled={readOnly}
                    onChange={() => void toggle(r.n, !r.done)}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <label htmlFor={inputId} className={cn('block text-[14px]', readOnly ? 'cursor-default' : 'cursor-pointer', r.done ? 'text-fg2' : 'text-fg')}>
                      {r.text}
                    </label>
                    {r.expected !== null && <p id={`${inputId}-exp`} className="m-0 mt-0.5 text-[12.5px] text-fg3">Expected: {r.expected}</p>}
                    <ReviewSteps id={`${inputId}-steps`} steps={r.steps} />
                    {failed && (
                      <p id={`${inputId}-fail`} className="m-0 mt-1 text-[12.5px] font-medium wrap-anywhere text-block-ink">
                        Failed: {r.failed}
                      </p>
                    )}
                    {r.fixed.map((f, i) => (
                      <p key={i} className="m-0 mt-0.5 text-[12px] wrap-anywhere text-fg3">
                        Fixed: {f}
                      </p>
                    ))}
                    {open && (
                      <form
                        className="mt-2 flex flex-col gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          save();
                        }}
                      >
                        <label htmlFor={`${inputId}-why`} className="text-[12.5px] font-semibold text-fg2">
                          What went wrong?
                        </label>
                        <textarea
                          id={`${inputId}-why`}
                          autoFocus
                          rows={2}
                          className="w-full resize-y rounded-[7px] border border-line2 bg-card px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
                          value={editing.text}
                          onChange={(e) => setEditing({ n: r.n, text: e.target.value })}
                          onKeyDown={(e) => {
                            // Enter saves (the reason is one line); Shift+Enter is still allowed and becomes a space.
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              save();
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <button type="submit" className={cn(smallButton, 'border-0 bg-accent text-accent-fg hover:bg-accent-hover')} disabled={oneLine(editing.text) === ''}>
                            Save
                          </button>
                          <button type="button" className={smallButton} onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                    {!readOnly && !r.done && !open && (
                      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Check: ${r.text}`}>
                        <button type="button" className={smallButton} onClick={() => void toggle(r.n, true)}>
                          Pass
                        </button>
                        {failed ? (
                          <>
                            <button type="button" className={smallButton} onClick={() => setEditing({ n: r.n, text: r.failed ?? '' })}>
                              Edit
                            </button>
                            <button type="button" className={smallButton} onClick={() => void setFailed(r.n, null)}>
                              Clear
                            </button>
                          </>
                        ) : (
                          <button type="button" className={smallButton} onClick={() => setEditing({ n: r.n, text: '' })}>
                            Fail
                          </button>
                        )}
                      </div>
                    )}
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
