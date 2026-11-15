import { useEffect, useRef, useState, type Ref } from 'react';
import type { Question, Spec } from '@specboard/core';
import { api, ConflictError } from '@/api/client';
import { OFFLINE_TOAST, type Mutate } from '@/state/actions';
import type { PushToast } from '@/state/toasts';
import { CheckIcon, DotIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { section, sectionHead, sectionLabel } from '../section';

// Open questions (prototype lines 186-218, view-model 671-676, saveAnswers 626-630; pinned behaviour 9).

export type AnswersClient = Pick<typeof api, 'setAnswers'>;

export interface QuestionsProps {
  pid: string;
  spec: Spec;
  /** The spec file, relative to the project, for the "Written to" toast. */
  path: string;
  client?: AnswersClient;
  mutate: Mutate;
  refresh: () => Promise<void>;
  toast: PushToast;
  down?: boolean;
  /** `${specId}:${qid}` for questions first seen through a live update. */
  newQuestions?: ReadonlySet<string>;
  /** Called with the New keys of this spec once its answers are saved. */
  onSeen?: (keys: string[]) => void;
  /** Typed but unsaved answers exist (F3c): the detail asks before it is left. */
  onDirtyChange?: (dirty: boolean) => void;
  sectionRef?: Ref<HTMLElement>;
  /** Accent border (the blocked banner's scroll target). */
  highlight?: boolean;
}

export const SAVED_MS = 1800;
/** A count beside the section label ("3 waiting on you", "1 optional"). */
const pill = 'rounded-full px-[7px] py-px text-[11.5px] font-semibold';
/** Required / Optional / New after a question. */
const tag = 'ml-2 rounded-[5px] px-1.5 py-px text-[11px] font-semibold whitespace-nowrap';
const NONE: ReadonlySet<string> = new Set();
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** An empty answer is no answer. */
const norm = (v: string | null) => (v === '' ? null : v);

type SaveState = 'idle' | 'saving' | 'saved';

export function Questions({
  pid,
  spec,
  path,
  client = api,
  mutate,
  refresh,
  toast,
  down = false,
  newQuestions = NONE,
  onSeen,
  onDirtyChange,
  sectionRef,
  highlight = false,
}: QuestionsProps) {
  const id = spec.id;
  /** Unsaved values by question ID. */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sv, setSv] = useState<SaveState>('idle');
  /** New badges cleared by a save here (the parent may not drop them from `newQuestions`). */
  const [seen, setSeen] = useState<ReadonlySet<string>>(NONE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const value = (q: Question): string | null => (Object.prototype.hasOwnProperty.call(draft, q.id) ? draft[q.id]! : q.answer);
  const isChanged = (q: Question) => norm(value(q)) !== norm(q.answer);
  const changedQs = spec.questions.filter(isChanged);
  const dirty = changedQs.length > 0;
  const dirtyCb = useRef(onDirtyChange);
  dirtyCb.current = onDirtyChange;
  useEffect(() => dirtyCb.current?.(dirty), [dirty]);
  const unanswered = spec.questions.filter((q) => q.answer === null || q.answer === '');
  const open = unanswered.filter((q) => q.required).length;
  const optional = unanswered.length - open;
  const newKey = (q: Question) => `${id}:${q.id}`;
  const isNew = (q: Question) => newQuestions.has(newKey(q)) && !seen.has(newKey(q));

  const set = (qid: string, v: string) => setDraft((d) => ({ ...d, [qid]: v }));

  const save = async () => {
    if (sv !== 'idle' || !dirty) return;
    if (down) return toast('err', ...OFFLINE_TOAST);
    // Only the changed values; '' clears an answer.
    const answers: Record<string, string> = {};
    for (const q of changedQs) answers[q.id] = value(q) ?? '';
    setSv('saving');
    try {
      await mutate(id, spec.hash, (h) => client.setAnswers(pid, id, h, answers));
    } catch (e) {
      setSv('idle');
      if (e instanceof ConflictError) {
        // Keep the drafts: the user saves again on top of the fresh file.
        await refresh();
        toast('err', 'Couldn’t save answers', 'The file changed. Your answers are still here. Save again.');
      } else {
        toast('err', 'Couldn’t save answers', message(e));
      }
      return;
    }
    await refresh();
    // Drop the drafts that were saved (a value typed while saving stays a draft).
    setDraft((d) => {
      const rest = { ...d };
      for (const [qid, v] of Object.entries(answers)) if (rest[qid] === v) delete rest[qid];
      return rest;
    });
    const cleared = spec.questions.filter(isNew).map(newKey);
    if (cleared.length > 0) {
      setSeen((x) => new Set([...x, ...cleared]));
      onSeen?.(cleared);
    }
    setSv('saved');
    toast('ok', 'Answers saved', `Written to ${path}`);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setSv('idle');
    }, SAVED_MS);
  };

  const idleHint = optional > 0 ? 'Claude goes with its recommendation on optional questions you leave blank' : '';
  const hint = sv === 'saved' ? 'Claude will pick these up on its next run' : dirty ? 'Unsaved answers' : idleHint;
  const label = sv === 'saving' ? 'Saving…' : sv === 'saved' ? 'Saved' : 'Save changes';
  const btn =
    sv === 'saved'
      ? 'cursor-default bg-done-soft text-done-ink'
      : sv === 'saving'
        ? 'cursor-default bg-accent text-accent-fg'
        : dirty
          ? 'cursor-pointer bg-accent text-accent-fg'
          : 'cursor-default bg-panel text-fg3';

  return (
    <section
      ref={sectionRef}
      id={`${id}-questions`}
      data-section="questions"
      aria-label="Open questions"
      data-highlight={highlight}
      className={section}
    >
      <div className={sectionHead}>
        <span className={sectionLabel}>OPEN QUESTIONS</span>
        {open > 0 && <span className={cn(pill, 'bg-review-soft text-review-ink')}>{`${open} waiting on you`}</span>}
        {optional > 0 && <span className={cn(pill, 'bg-panel text-fg2')}>{`${optional} optional`}</span>}
      </div>
      {spec.questions.length === 0 ? (
        <div className="px-4 py-[18px] text-[13.5px] text-fg3">No open questions. Claude has what it needs.</div>
      ) : (
        <>
          <div className="flex flex-col">
            {spec.questions.map((q, i) => {
              const v = value(q);
              const changed = isChanged(q);
              const answered = q.answer !== null && q.answer !== '';
              const inputId = `${id}-${q.id}`;
              const labelId = `${inputId}-label`;
              const waiting = !answered && q.required;
              const stateText = changed ? 'Unsaved' : answered ? 'Answered' : waiting ? 'Needs answer' : 'Can skip';
              const StateIcon = changed ? DotIcon : answered ? CheckIcon : null;
              const stateInk = changed ? 'text-accent-ink' : answered ? 'text-done-ink' : waiting ? 'text-review-ink' : 'text-fg3';
              const opts = q.type === 'yesno' ? ['Yes', 'No'] : q.type === 'choice' ? q.options : [];
              return (
                <div
                  key={q.id}
                  data-question={q.id}
                  data-required={q.required}
                  data-attention={!((answered || !q.required) && !changed)}
                  className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-1 border-b border-line bg-transparent px-4 py-3.5 data-[attention=true]:bg-review-soft"
                >
                  <span className="pt-0.5 font-mono text-[12.5px] text-fg3">{`${i + 1}.`}</span>
                  <div className="flex min-w-0 flex-col gap-2.5">
                    {/* For radios the label names the group; a `for` would pick the first option on click. */}
                    <label {...(opts.length === 0 ? { htmlFor: inputId } : {})} className="text-[14px] leading-[1.45] font-medium text-pretty">
                      <span id={labelId}>{q.text}</span>
                      {q.recommendation !== null && <span className="font-normal text-fg2">{` (recommended: ${q.recommendation})`}</span>}
                      <span className={cn(tag, q.required ? 'bg-review-soft text-review-ink' : 'bg-panel text-fg2')}>
                        {q.required ? 'Required' : 'Optional'}
                      </span>
                      {isNew(q) && <span className={cn(tag, 'bg-accent-soft text-accent-ink')}>New</span>}
                    </label>
                    {(q.type === 'yesno' || q.type === 'choice') && (
                      <div role="radiogroup" aria-labelledby={labelId} className={cn('flex gap-2', q.type === 'choice' && 'flex-wrap')}>
                        {opts.map((o) => (
                          <label
                            key={o}
                            className={cn(
                              'flex h-8 cursor-pointer items-center gap-[7px] rounded-lg border bg-card pr-3 pl-2.5 text-[13.5px]',
                              v === o ? 'border-accent' : 'border-line2',
                            )}
                          >
                            <input
                              type="radio"
                              className="m-0 size-[15px] p-0"
                              name={inputId}
                              value={o}
                              checked={v === o}
                              onChange={() => set(q.id, o)}
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === 'number' && (
                      <div>
                        <input
                          id={inputId}
                          aria-labelledby={labelId}
                          type="number"
                          min={1}
                          className="h-8 w-[84px] rounded-lg border border-line2 bg-card px-2.5 py-0 font-mono text-[13.5px] text-fg"
                          value={v ?? ''}
                          placeholder="0"
                          onChange={(e) => set(q.id, e.target.value)}
                        />
                      </div>
                    )}
                    {q.type === 'text' && (
                      <textarea
                        id={inputId}
                        aria-labelledby={labelId}
                        rows={2}
                        className="w-full max-w-[520px] resize-y rounded-lg border border-line2 bg-card px-2.5 py-2 text-[13.5px] leading-[1.5] text-fg"
                        value={v ?? ''}
                        placeholder="Type your answer…"
                        onChange={(e) => set(q.id, e.target.value)}
                      />
                    )}
                  </div>
                  <span data-state="" className={cn('inline-flex items-center gap-[5px] pt-0.5 text-[12px] font-semibold whitespace-nowrap', stateInk)}>
                    {StateIcon && <StateIcon aria-hidden />}
                    {stateText}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-3 px-4 py-3">
            <span className="text-[12.5px] text-fg3">{hint}</span>
            <button type="button" className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border-0 px-3.5 py-0 text-[13px] font-semibold', btn)} disabled={sv !== 'idle' || !dirty} onClick={() => void save()}>
              {sv === 'saved' && <CheckIcon aria-hidden />}
              {label}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
