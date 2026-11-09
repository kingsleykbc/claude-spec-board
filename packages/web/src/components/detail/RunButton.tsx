import { useEffect, useRef, useState } from 'react';
import s from './detail.module.css';

export type RunState = 'ready' | 'running' | 'disabled' | 'fallback';

export interface RunButtonProps {
  id: string;
  state: RunState;
  /** The spec Claude is working on, for the disabled note; null while it refreshes the overview. */
  runningId?: string | null;
  onRun: () => void;
  onStop: () => void;
}

export const COPIED_MS = 2600;
/** How long "Copy failed: run …" stays, so the command can be selected by hand. */
export const COPY_FAILED_MS = 6000;

/** The header's Run control in its four states (prototype lines 128-131, 679-683). */
export function RunButton({ id, state, runningId, onRun, onStop }: RunButtonProps) {
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

  const command = `claude "/run-spec ${id}"`;
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
  if (state === 'disabled') {
    const text = `Claude is already working on ${runningId ?? 'the overview'}`;
    return (
      <>
        <span className={s.runNote}>{text}</span>
        <button type="button" className={s.runOff} disabled title={text}>
          <span className={s.play}>▶</span>Tell Claude to start
        </button>
      </>
    );
  }
  if (state === 'fallback') {
    const copied = copy === 'copied';
    return (
      <>
        {copy === 'failed' ? (
          <span className={s.copyFailed} data-testid="copy-failed">
            Copy failed: run <span style={{ userSelect: 'all', fontFamily: 'var(--mono)' }}>{command}</span>
          </span>
        ) : (
          <span className={s.runNote}>Claude Code not found</span>
        )}
        <button type="button" className={s.copy} data-copied={copied} onClick={doCopy}>
          {copied ? '✓ Copied: paste it into Claude Code' : '⧉ Copy command'}
        </button>
      </>
    );
  }
  return (
    <button type="button" className={s.run} onClick={onRun}>
      <span className={s.play}>▶</span>Tell Claude to start
    </button>
  );
}
