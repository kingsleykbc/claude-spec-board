import { useEffect, useRef, useState } from 'react';
import type { EndInfo, RunKind, RunLine, RunStatus } from '../../api/client';
import { allowHint } from '../../lib/prePublish';
import { LINE } from '../../lib/vm';
import { FileLink } from '../../state/fileLinks';
import { Spinner } from '../ConnectionBanner';
import s from './sections.module.css';

// The RUN OUTPUT aside (prototype lines 270-291, END and CHIP at lines 683-691). Purely
// presentational: the board feeds it the server's run.

export type { RunStatus };

/** The end card's button: Go to question, Copy rule (after the clipboard accepted it), Run again. */
export type RunAction = 'question' | 'copy' | 'rerun';

export interface RunPanelProps {
  /** What the run was doing, for the copy of a finished run the server says nothing about. Defaults to `run`. */
  kind?: RunKind;
  status: RunStatus;
  lines: RunLine[];
  /** The server's end info; what it leaves out falls back to `END`. */
  end?: EndInfo | null;
  /** The project's folder, for the command shown under a rule. */
  projectRoot?: string;
  onDismiss: () => void;
  onAction: (action: RunAction) => void;
}

export const FIX_NOTE = 'Run this in a terminal, then run again.';

/** Lines whose `code` names a file. A Read line can also hold a search pattern, which has wildcards and no place on disk. */
const FILE_LINE: ReadonlySet<string> = new Set(['read', 'edit']);
const LOOKS_LIKE_FILE = /^[^*?<>|"]+$/;

interface End {
  title: string;
  text: string;
  ink: string;
  border: string;
  action?: { label: string; kind: RunAction };
}

const END: Record<Exclude<RunStatus, 'running'>, End> = {
  finished: {
    title: 'Done. Moved to Review.',
    text: 'All subtasks are committed. Check the work, then move the card to Done.',
    ink: 'var(--done-ink)',
    border: 'var(--done)',
  },
  stopped: {
    title: 'Stopped by you',
    text: 'Claude stopped after its last step. Everything finished so far is committed. Run again to continue.',
    ink: 'var(--fg)',
    border: 'var(--line2)',
  },
  needs: {
    title: 'Stopped: needs your answer',
    text: 'Claude added a new open question and paused until you answer it.',
    ink: 'var(--review-ink)',
    border: 'var(--review)',
    action: { label: 'Go to question', kind: 'question' },
  },
  permission: {
    title: 'Stopped: permission needed',
    text: 'Claude tried something this project doesn’t allow yet.',
    ink: 'var(--block-ink)',
    border: 'var(--block)',
    action: { label: 'Copy rule', kind: 'copy' },
  },
  error: {
    title: 'Error',
    text: 'Claude Code exited unexpectedly. Work up to the last commit is safe.',
    ink: 'var(--block-ink)',
    border: 'var(--block)',
    action: { label: 'Run again', kind: 'rerun' },
  },
};

/** A finished write-up or fix did not move anything to Review. */
const FINISHED: Partial<Record<RunKind, { title: string; text: string }>> = {
  'write-up': { title: 'Written up', text: 'Features, questions and subtasks are on the card. Check them, then run it.' },
  'fix-file': { title: 'Fixed', text: 'Claude finished fixing the file. Check the spec.' },
};

const CHIP: Record<RunStatus, [string, string, string]> = {
  running: ['Running', 'var(--doing-soft)', 'var(--doing-ink)'],
  finished: ['Finished', 'var(--done-soft)', 'var(--done-ink)'],
  stopped: ['Stopped', 'var(--panel)', 'var(--fg2)'],
  needs: ['Needs your answer', 'var(--review-soft)', 'var(--review-ink)'],
  permission: ['Permission needed', 'var(--block-soft)', 'var(--block-ink)'],
  error: ['Error', 'var(--block-soft)', 'var(--block-ink)'],
};

/** Sample lines from the prototype (line 553), for stories and tests. */
export const RUN_LINES: RunLine[] = [
  { seq: 1, k: 'start', text: 'Started on T-104 · Meal planner calendar', time: '15:08' },
  { seq: 2, k: 'read', text: 'Read', code: 'specs/T-104-meal-planner-calendar.md', time: '15:08' },
  { seq: 3, k: 'done', text: 'Subtask 1 done: Create calendar grid · committed', code: '4f2a91c', time: '15:31' },
  { seq: 4, k: 'done', text: 'Subtask 2 done: Drag recipe onto a day · committed', code: 'a1b2c3d', time: '16:40' },
  { seq: 5, k: 'read', text: 'Starting subtask 3: Persist planned meals', time: '16:41' },
  { seq: 6, k: 'edit', text: 'Editing', code: 'src/api/plannedMeals.ts', time: '16:44' },
];

export const COPIED_MS = 2600;
export const COPY_FAILED_MS = 6000;

export function RunPanel({ kind = 'run', status, lines, end: server, projectRoot, onDismiss, onAction }: RunPanelProps) {
  const running = status === 'running';
  const base = running ? null : END[status];
  const fallback = base && status === 'finished' ? (FINISHED[kind] ?? base) : base;
  // `fix` is absent when the action is blocked by policy: then there is nothing to copy, and the text says why.
  const fix = status === 'permission' ? server?.fix : undefined;
  const end = base && {
    ...base,
    title: server?.title ?? fallback!.title,
    text: server?.text ?? fallback!.text,
    action: status === 'permission' && !fix ? undefined : base.action,
  };
  const [chipLabel, chipBg, chipInk] = CHIP[status];

  // Copy rule: the same honest feedback as RunButton's copy (confirm only once the clipboard took it).
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);
  const show = (next: 'copied' | 'failed') => {
    if (!alive.current) return;
    setCopy(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        setCopy('idle');
      },
      next === 'copied' ? COPIED_MS : COPY_FAILED_MS,
    );
  };
  const copyRule = () => {
    let p: Promise<void>;
    try {
      const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      if (!clip) throw new Error('No clipboard');
      p = clip.writeText(fix ?? '');
    } catch {
      show('failed');
      return;
    }
    Promise.resolve(p).then(
      () => {
        show('copied');
        if (alive.current) onAction('copy');
      },
      () => show('failed'),
    );
  };

  // Keep the newest line in view, as the prototype's feed does.
  const feed = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <aside aria-label="Run output" className={s.aside}>
      <div className={s.runHead}>
        <span className={s.label}>RUN OUTPUT</span>
        <span data-testid="run-chip" className={s.runChip} style={{ background: chipBg, color: chipInk }}>
          {running && <span className={s.pulse} aria-hidden="true" />}
          {chipLabel}
        </span>
        <span className={s.grow} />
        {!running && (
          <button type="button" className={s.dismiss} onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
      <div ref={feed} className={s.feed}>
        {lines.map((ln) => {
          const [icon, ic] = LINE[ln.k] ?? ['·', 'var(--fg3)'];
          return (
            <div key={ln.seq} className={s.line}>
              <span data-testid="line-icon" className={s.lineIcon} style={{ color: ic }}>
                {icon}
              </span>
              <span className={s.lineText} style={{ fontWeight: ln.k === 'done' || ln.k === 'start' ? 600 : 400 }}>
                {ln.text}{' '}
                {ln.code && (FILE_LINE.has(ln.k) && LOOKS_LIKE_FILE.test(ln.code) ? <code className={s.lineCode}><FileLink path={ln.code} /></code> : <code className={s.lineCode}>{ln.code}</code>)}
              </span>
              <span className={s.lineTime}>{ln.time}</span>
            </div>
          );
        })}
        {running && (
          <div className={s.working}>
            <Spinner />
            Working…
          </div>
        )}
      </div>
      {end && (
        <div data-testid="run-end" className={s.end} style={{ borderColor: end.border }}>
          <span className={s.endTitle} style={{ color: end.ink }}>
            {end.title}
          </span>
          <span className={s.endText}>{end.text}</span>
          {fix && (
            <>
              <code className={s.fix}>{fix}</code>
              <span className={s.fixNote}>{FIX_NOTE}</span>
              <span className={s.fixNote}>{allowHint(projectRoot)}</span>
            </>
          )}
          {end.action &&
            (end.action.kind === 'copy' ? (
              <>
                <button type="button" className={s.endBtn} data-copied={copy === 'copied'} onClick={copyRule}>
                  {copy === 'copied' ? '✓ Copied rule' : end.action.label}
                </button>
                {copy === 'failed' && (
                  <span className={s.copyFailed} role="status">
                    Copy failed: select the rule above and copy it.
                  </span>
                )}
              </>
            ) : (
              <button type="button" className={s.endBtn} onClick={() => onAction(end.action!.kind)}>
                {end.action.label}
              </button>
            ))}
        </div>
      )}
    </aside>
  );
}
