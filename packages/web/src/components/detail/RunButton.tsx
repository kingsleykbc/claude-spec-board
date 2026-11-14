import { useEffect, useRef, useState } from 'react';
import { docsPath } from '../../lib/docsPages';
import { CheckIcon, CopyIcon, HelpIcon, PlayIcon } from '../../lib/icons';
import s from './detail.module.css';

export type RunState = 'ready' | 'running' | 'disabled' | 'fallback';

export interface RunButtonProps {
  id: string;
  state: RunState;
  /** The spec Claude is working on, for the disabled note; null while it refreshes the overview. */
  runningId?: string | null;
  /** Why this spec shouldn't start yet (blocked or a draft), so no usage is spent finding out. */
  hold?: string | null;
  /** In the fallback: what a registered project has to do with it, since "not found" would mislead. */
  blockedNote?: string | undefined;
  /** The disabled note when the active run has no spec to name and isn't the overview (a project-level sync). */
  busyNote?: string | undefined;
  onRun: () => void;
  onStop: () => void;
}

export const COPIED_MS = 2600;
/** How long "Copy failed: paste …" stays, so the command can be selected by hand. */
export const COPY_FAILED_MS = 6000;

export const CHAT_TITLE = 'Copies the command to paste into a Claude chat open in this project. You see all the work in that chat, and this card follows along. It uses your normal Claude settings and approvals.';
export const BACKGROUND_TITLE = 'Starts a separate Claude with its output on this card. It can’t ask you anything, ignores the project’s and your Claude settings, and can only do what you approved. Best for a repo you don’t fully trust.';

/**
 * The header's Run controls in their four states (prototype lines 128-131, 679-683). Both ways are secondary buttons of
 * equal weight: copy the run command for a Claude chat (the board can't type into one), or run it in the background.
 * docs/guide/running-specs.md says when to use which.
 */
export function RunButton({ id, state, runningId, hold, blockedNote, busyNote, onRun, onStop }: RunButtonProps) {
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

  const command = `/run-spec ${id}`;
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
  const doCopy = () => {
    let p: Promise<void>;
    try {
      const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      if (!clip) throw new Error('No clipboard');
      p = clip.writeText(command);
    } catch {
      show('failed');
      return;
    }
    // Confirm only once the browser says the text is on the clipboard.
    Promise.resolve(p).then(
      () => show('copied'),
      () => show('failed'),
    );
  };

  if (state === 'running') {
    return (
      <button type="button" className={s.stop} onClick={onStop}>
        <span className={s.stopIcon} />
        Stop
      </button>
    );
  }

  const help = (
    <a className={s.runHelp} href={docsPath('running-specs')} target="_blank" rel="noopener" aria-label="Chat or background: which to use" title="Chat or background: which to use">
      <HelpIcon aria-hidden />
    </a>
  );
  const copied = copy === 'copied';
  const failedNote = copy === 'failed' && (
    <span className={s.copyFailed} data-testid="copy-failed">
      Copy failed: paste <span style={{ userSelect: 'all', fontFamily: 'var(--mono)' }}>{command}</span> into your Claude chat
    </span>
  );
  const copyLabel = copied ? (
    <>
      <CheckIcon aria-hidden />
      Copied: paste it into your Claude chat
    </>
  ) : (
    <>
      <CopyIcon aria-hidden />
      Copy run command
    </>
  );

  // Another run is going, or the spec can't start: neither way should begin.
  const off = state === 'disabled' ? (busyNote ?? `Claude is already working on ${runningId ?? 'the overview'}`) : state === 'ready' ? hold : null;
  if (off) {
    return (
      <>
        <span className={s.runNote} title={off}>{off}</span>
        <button type="button" className={s.runOff} disabled title={off}>
          <CopyIcon aria-hidden />
          Copy run command
        </button>
      </>
    );
  }

  if (state === 'fallback') {
    return (
      <>
        {failedNote || (blockedNote ? <span className={s.runNoteLong}>{blockedNote}</span> : <span className={s.runNote}>Claude Code not found</span>)}
        {help}
        <button type="button" className={s.copy} data-copied={copied} title={CHAT_TITLE} onClick={doCopy}>
          {copyLabel}
        </button>
      </>
    );
  }

  return (
    <>
      {failedNote}
      {help}
      <button type="button" className={s.copy} title={BACKGROUND_TITLE} onClick={onRun}>
        <PlayIcon aria-hidden className={s.play} />
        Run in background
      </button>
      <button type="button" className={s.copy} data-copied={copied} title={CHAT_TITLE} onClick={doCopy}>
        {copyLabel}
      </button>
    </>
  );
}
