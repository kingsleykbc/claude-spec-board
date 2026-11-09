import { useEffect, useRef, useState, type Ref } from 'react';
import type { Question, Spec } from '@specboard/core';
import { api, ConflictError } from '../../api/client';
import { OFFLINE_TOAST, type Mutate } from '../../state/actions';
import type { PushToast } from '../../state/toasts';
import s from './sections.module.css';

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
  const label = sv === 'saving' ? 'Saving…' : sv === 'saved' ? '✓ Saved' : 'Save changes';
  const btn = {
    background: sv === 'saved' ? 'var(--done-soft)' : (dirty && sv === 'idle') || sv === 'saving' ? 'var(--accent)' : 'var(--panel)',
    color: sv === 'saved' ? 'var(--done-ink)' : dirty || sv === 'saving' ? 'var(--accent-fg)' : 'var(--fg3)',
    cursor: dirty && sv === 'idle' ? 'pointer' : 'default',
  };

  return (
    <section
      ref={sectionRef}
      id={`${id}-questions`}
      data-section="questions"
      aria-label="Open questions"
      className={s.section}
      style={{ borderColor: highlight ? 'var(--accent)' : 'var(--line)' }}
    >
      <div className={s.head}>
        <span className={s.label}>OPEN QUESTIONS</span>
        {open > 0 && <span className={s.waiting}>{`${open} waiting on you`}</span>}
        {optional > 0 && <span className={s.optionalCount}>{`${optional} optional`}</span>}
      </div>
      {spec.questions.length === 0 ? (
        <div className={s.empty}>No open questions. Claude has what it needs.</div>
      ) : (
        <>
          <div className={s.list}>
            {spec.questions.map((q, i) => {
              const v = value(q);
              const changed = isChanged(q);
              const answered = q.answer !== null && q.answer !== '';
              const inputId = `${id}-${q.id}`;
              const labelId = `${inputId}-label`;
              const waiting = !answered && q.required;
              const stateText = changed ? '● Unsaved' : answered ? '✓ Answered' : waiting ? 'Needs answer' : 'Can skip';
              const stateInk = changed ? 'var(--accent-ink)' : answered ? 'var(--done-ink)' : waiting ? 'var(--review-ink)' : 'var(--fg3)';
              const opts = q.type === 'yesno' ? ['Yes', 'No'] : q.type === 'choice' ? q.options : [];
              return (
                <div
                  key={q.id}
                  data-question={q.id}
                  className={s.qRow}
                  data-required={q.required}
                  style={{ background: (answered || !q.required) && !changed ? 'transparent' : 'var(--review-soft)' }}
                >
                  <span className={s.qNum}>{`${i + 1}.`}</span>
                  <div className={s.qBody}>
                    {/* For radios the label names the group; a `for` would pick the first option on click. */}
                    <label {...(opts.length === 0 ? { htmlFor: inputId } : {})} className={s.qLabel}>
                      <span id={labelId}>{q.text}</span>
                      {q.recommendation !== null && <span className={s.qRec}>{` (recommended: ${q.recommendation})`}</span>}
                      <span className={s.qTag} data-required={q.required}>
                        {q.required ? 'Required' : 'Optional'}
                      </span>
                      {isNew(q) && <span className={s.new}>New</span>}
                    </label>
                    {(q.type === 'yesno' || q.type === 'choice') && (
                      <div role="radiogroup" aria-labelledby={labelId} className={q.type === 'choice' ? `${s.radios} ${s.wrap}` : s.radios}>
                        {opts.map((o) => (
                          <label key={o} className={s.opt} style={{ borderColor: v === o ? 'var(--accent)' : 'var(--line2)' }}>
                            <input
                              type="radio"
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
                          className={s.number}
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
                        className={s.text}
                        value={v ?? ''}
                        placeholder="Type your answer…"
                        onChange={(e) => set(q.id, e.target.value)}
                      />
                    )}
                  </div>
                  <span data-state="" className={s.state} style={{ color: stateInk }}>
                    {stateText}
                  </span>
                </div>
              );
            })}
          </div>
          <div className={s.foot}>
            <span className={s.hint}>{hint}</span>
            <button type="button" className={s.saveBtn} style={btn} disabled={sv !== 'idle' || !dirty} onClick={() => void save()}>
              {label}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
