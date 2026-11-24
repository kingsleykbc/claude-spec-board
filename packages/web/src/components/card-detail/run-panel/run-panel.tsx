import { useEffect, useRef, useState } from 'react';
import type { EndInfo, RunKind, RunLine, RunStatus } from '@/api/client';
import { allowHint } from '@/lib/prePublish';
import { CheckIcon, DotIcon } from '@/lib/icons';
import { usePluginMode } from '@/lib/mode';
import { cn } from '@/lib/utils';
import { LINE } from '@/lib/vm';
import { FileLink } from '@/state/fileLinks';
import { Spinner } from '@/components/connection-banner/connection-banner';
import { StartButton } from '@/components/ui/start-button/start-button';
import { sectionLabel } from '../section';

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
  /** An end card button. Run again may return a promise of the start: it says Starting… until it settles. */
  onAction: (action: RunAction) => unknown;
}

export const BACKGROUND_LINE = "Running in the background as a separate Claude session. It won't show in your terminal chat; follow it here.";

export const FIX_NOTE = 'Run this in a terminal, then run again.';

/** Lines whose `code` names a file. A Read line can also hold a search pattern, which has wildcards and no place on disk. */
const FILE_LINE: ReadonlySet<string> = new Set(['read', 'edit']);
const LOOKS_LIKE_FILE = /^[^*?<>|"]+$/;

interface End {
  title: string;
  text: string;
  /** Title colour and card border, as classes. */
  ink: string;
  border: string;
  action?: { label: string; kind: RunAction };
}

const END: Record<Exclude<RunStatus, 'running'>, End> = {
  finished: {
    title: 'Done. Moved to Review.',
    text: 'All subtasks are committed. Check the work, then move the card to Done.',
    ink: 'text-done-ink',
    border: 'border-done',
  },
  stopped: {
    title: 'Stopped by you',
    text: 'Claude stopped after its last step. Everything finished so far is committed. Run again to continue.',
    ink: 'text-fg',
    border: 'border-line2',
  },
  needs: {
    title: 'Stopped: needs your answer',
    text: 'Claude added a new open question and paused until you answer it.',
    ink: 'text-review-ink',
    border: 'border-review',
    action: { label: 'Go to question', kind: 'question' },
  },
  permission: {
    title: 'Stopped: permission needed',
    text: 'Claude tried something this project doesn’t allow yet.',
    ink: 'text-block-ink',
    border: 'border-block',
    action: { label: 'Copy rule', kind: 'copy' },
  },
  error: {
    title: 'Error',
    text: 'Claude Code exited unexpectedly. Work up to the last commit is safe.',
    ink: 'text-block-ink',
    border: 'border-block',
    action: { label: 'Run again', kind: 'rerun' },
  },
};

/** A `needs` end at a `(you)` step: a calm pause for the person's own work, with nothing to jump to. */
const WAITING: End = {
  title: 'Waiting on you',
  text: '',
  ink: 'text-review-ink',
  border: 'border-review',
};

/** A finished write-up, fix or sync did not move anything to Review. */
const FINISHED: Partial<Record<RunKind, { title: string; text: string }>> = {
  'sync-plan': { title: 'Sync proposal ready', text: 'Check what will change, then confirm or cancel it.' },
  'sync-apply': { title: 'Synced with the code', text: 'The spec now matches the code.' },
  'write-up': { title: 'Written up', text: 'Features, questions and subtasks are on the card. Check them, then run it.' },
  'fix-file': { title: 'Fixed', text: 'Claude finished fixing the file. Check the spec.' },
  'refresh-questions': { title: 'Refreshed', text: 'Questions and subtasks now match the spec text.' },
};

/** The status chip's words and colours (as classes). */
const CHIP: Record<RunStatus, [string, string]> = {
  running: ['Running', 'bg-doing-soft text-doing-ink'],
  finished: ['Finished', 'bg-done-soft text-done-ink'],
  stopped: ['Stopped', 'bg-panel text-fg2'],
  needs: ['Needs your answer', 'bg-review-soft text-review-ink'],
  permission: ['Permission needed', 'bg-block-soft text-block-ink'],
  error: ['Error', 'bg-block-soft text-block-ink'],
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

const lineCode = 'rounded-[4px] border border-line bg-code px-[5px] font-mono text-[11.5px] break-all text-fg2';
const fixNote = 'text-[12.5px] leading-[1.5] text-fg2';
const endBtn =
  'mt-1 inline-flex h-[30px] cursor-pointer items-center gap-1.5 self-start rounded-[7px] border border-line2 bg-card px-3 py-0 text-[12.5px] font-semibold text-fg hover:bg-panel data-[copied=true]:border-done data-[copied=true]:text-done-ink';

export function RunPanel({ kind = 'run', status, lines, end: server, projectRoot, onDismiss, onAction }: RunPanelProps) {
  const running = status === 'running';
  const waiting = status === 'needs' ? server?.waiting : undefined;
  const base = running ? null : waiting ? WAITING : END[status];
  const fallback = base && status === 'finished' ? (FINISHED[kind] ?? base) : base;
  // `fix` is absent when the action is blocked by policy: then there is nothing to copy, and the text says why.
  // A plugin user has `specboard` only inside Claude Code, so the terminal-only `specboard allow` is not offered to them.
  const plugin = usePluginMode();
  const rule = status === 'permission' ? server?.fix : undefined;
  const fix = plugin ? undefined : rule;
  const end = base && {
    ...base,
    title: server?.title ?? fallback!.title,
    text: waiting ? `Claude stopped at your step: ${waiting}. Do it, tick it, then run again.` : (server?.text ?? fallback!.text),
    action: status === 'permission' && !fix ? undefined : base.action,
  };
  const [chipLabel, chipTone] = waiting ? ['Waiting on you', CHIP.needs[1]] : CHIP[status];

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
    <aside aria-label="Run output" className="flex min-h-0 flex-col border-l border-line bg-bg">
      <div className="flex items-center gap-2.5 border-b border-line px-4 pt-3.5 pb-3">
        <span className={sectionLabel}>RUN OUTPUT</span>
        <span data-testid="run-chip" className={cn('inline-flex items-center gap-1.5 rounded-full px-[9px] py-0.5 text-[12px] font-semibold', chipTone)}>
          {running && <span className="inline-block size-[7px] flex-none animate-sb-pulse rounded-full bg-current" aria-hidden="true" />}
          {chipLabel}
        </span>
        <span className="flex-1" />
        {!running && (
          <button type="button" className="cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-1 text-[12.5px] text-fg2 hover:bg-panel" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
      <div ref={feed} className="min-h-0 flex-1 overflow-auto px-4 py-2.5">
        {lines.map((ln) => {
          const [Icon, ic] = LINE[ln.k] ?? [DotIcon, 'var(--fg3)'];
          return (
            <div key={ln.seq} className="grid animate-sb-in grid-cols-[16px_minmax(0,1fr)_auto] items-baseline gap-2 py-[5px]">
              <span data-testid="line-icon" className="inline-flex justify-center pt-0.5 text-[13px]" style={{ color: ic }}>
                <Icon aria-hidden />
              </span>
              <span className={cn('text-[13px] leading-[1.5] text-pretty', ln.k === 'done' || ln.k === 'start' ? 'font-semibold' : 'font-normal')}>
                {ln.text}{' '}
                {ln.code && (FILE_LINE.has(ln.k) && LOOKS_LIKE_FILE.test(ln.code) ? <code className={lineCode}><FileLink path={ln.code} /></code> : <code className={lineCode}>{ln.code}</code>)}
                {ln.after && <> {ln.after}</>}
              </span>
              <span className="font-mono text-[11px] text-fg3">{ln.time}</span>
            </div>
          );
        })}
        {running && <p className="m-0 pb-1 text-[12.5px] leading-[1.5] text-fg2">{BACKGROUND_LINE}</p>}
        {running && (
          <div className="flex items-center gap-2 py-2 text-[12.5px] text-fg3">
            <Spinner />
            Working…
          </div>
        )}
      </div>
      {end && (
        <div data-testid="run-end" className={cn('mx-3.5 mb-3.5 flex animate-sb-in flex-col gap-1.5 rounded-[10px] border bg-card px-3.5 py-[13px]', end.border)}>
          <span className={cn('text-[13.5px] font-semibold', end.ink)}>
            {end.title}
          </span>
          <span className="text-[13px] leading-[1.5] text-pretty text-fg2">{end.text}</span>
          {fix && (
            <>
              <code className="block rounded-md border border-line bg-code px-2.5 py-2 font-mono text-[11.5px] whitespace-pre-wrap select-all">{fix}</code>
              <span className={fixNote}>{FIX_NOTE}</span>
              <span className={fixNote}>{allowHint(projectRoot, false)}</span>
            </>
          )}
          {rule && plugin && <span className={fixNote}>{allowHint(projectRoot, true)}</span>}
          {end.action &&
            (end.action.kind === 'copy' ? (
              <>
                <button type="button" className={endBtn} data-copied={copy === 'copied'} onClick={copyRule}>
                  {copy === 'copied' ? (
                    <>
                      <CheckIcon aria-hidden /> Copied rule
                    </>
                  ) : (
                    end.action.label
                  )}
                </button>
                {copy === 'failed' && (
                  <span className="text-[12px] text-block-ink" role="status">
                    Copy failed: select the rule above and copy it.
                  </span>
                )}
              </>
            ) : end.action.kind === 'rerun' ? (
              // Run again starts Claude: Starting… until the new run takes the panel over.
              <StartButton className={cn(endBtn, 'disabled:cursor-default disabled:hover:bg-card')} onStart={() => onAction('rerun')}>
                {end.action.label}
              </StartButton>
            ) : (
              <button type="button" className={endBtn} onClick={() => onAction(end.action!.kind)}>
                {end.action.label}
              </button>
            ))}
        </div>
      )}
    </aside>
  );
}
