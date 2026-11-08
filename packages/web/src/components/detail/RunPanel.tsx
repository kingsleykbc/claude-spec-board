import { useEffect, useRef, useState } from 'react';
import { LINE } from '../../lib/vm';
import { Spinner } from '../ConnectionBanner';
import s from './sections.module.css';

// The RUN OUTPUT aside (prototype lines 270-291, END and CHIP at lines 683-691). Purely
// presentational: M3 feeds it real lines; in M2 it is shown in stories only.

export type RunStatus = 'running' | 'finished' | 'stopped' | 'needs' | 'permission' | 'error';
/** The prototype's LINE map keys (lib/vm.ts). */
export type RunLineKind = 'start' | 'read' | 'edit' | 'cmd' | 'ok' | 'done' | 'stop' | 'warn' | 'err';

export interface RunLine {
  k: RunLineKind;
  text: string;
  /** Shown as inline code after the text (a path, command or commit). */
  code?: string;
  time?: string;
}

/** The end card's button: Go to question, Copy rule (after the clipboard accepted it), Run again. */
export type RunAction = 'question' | 'copy' | 'rerun';

export interface RunPanelProps {
  status: RunStatus;
  lines: RunLine[];
  onDismiss: () => void;
  onAction: (action: RunAction) => void;
}

export const PERMISSION_RULE = '"permissions": { "allow": ["Bash(npm install:*)"] }';

interface End {
  title: string;
  text: string;
  ink: string;
  border: string;
  fix?: string;
  fixNote?: string;
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
    text: 'Claude tried to install a package, which this project doesn’t allow yet.',
    ink: 'var(--block-ink)',
    border: 'var(--block)',
    fix: PERMISSION_RULE,
    fixNote: 'Add this to .claude/settings.json, or install date-fns yourself, then run again.',
    action: { label: 'Copy rule', kind: 'copy' },
  },
  error: {
    title: 'Error',
    text: 'Claude Code exited unexpectedly (code 1). The terminal has the full output. Work up to the last commit is safe.',
    ink: 'var(--block-ink)',
    border: 'var(--block)',
    action: { label: 'Run again', kind: 'rerun' },
  },
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
  { k: 'start', text: 'Started on T-104 · Meal planner calendar', time: '15:08' },
  { k: 'read', text: 'Read', code: 'specs/T-104-meal-planner-calendar.md', time: '15:08' },
  { k: 'done', text: 'Subtask 1 done: Create calendar grid · committed', code: '4f2a91c', time: '15:31' },
  { k: 'done', text: 'Subtask 2 done: Drag recipe onto a day · committed', code: 'a1b2c3d', time: '16:40' },
  { k: 'read', text: 'Starting subtask 3: Persist planned meals', time: '16:41' },
  { k: 'edit', text: 'Editing', code: 'src/api/plannedMeals.ts', time: '16:44' },
];

export const COPIED_MS = 2600;
export const COPY_FAILED_MS = 6000;

export function RunPanel({ status, lines, onDismiss, onAction }: RunPanelProps) {
  const running = status === 'running';
  const end = running ? null : END[status];
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
      p = clip.writeText(PERMISSION_RULE);
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
        {lines.map((ln, i) => {
          const [icon, ic] = LINE[ln.k] ?? ['·', 'var(--fg3)'];
          return (
            <div key={i} className={s.line}>
              <span data-testid="line-icon" className={s.lineIcon} style={{ color: ic }}>
                {icon}
              </span>
              <span className={s.lineText} style={{ fontWeight: ln.k === 'done' || ln.k === 'start' ? 600 : 400 }}>
                {ln.text} {ln.code && <code className={s.lineCode}>{ln.code}</code>}
              </span>
              <span className={s.lineTime}>{ln.time ?? ''}</span>
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
          {end.fix && (
            <>
              <code className={s.fix}>{end.fix}</code>
              <span className={s.fixNote}>{end.fixNote}</span>
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
