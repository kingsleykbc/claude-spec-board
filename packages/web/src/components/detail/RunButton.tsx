import { useEffect, useRef, useState } from 'react';
import s from './detail.module.css';

export type RunState = 'ready' | 'running' | 'disabled' | 'fallback';

export interface RunButtonProps {
  id: string;
  state: RunState;
  /** The spec Claude is working on, for the disabled note. */
  runningId?: string | null;
  onRun: () => void;
  onStop: () => void;
}

export const COPIED_MS = 2600;

/** The header's Run control in its four states (prototype lines 128-131, 679-683). */
export function RunButton({ id, state, runningId, onRun, onStop }: RunButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const copy = () => {
    try {
      const p = navigator.clipboard?.writeText(`claude "/run-spec ${id}"`);
      if (p) p.catch(() => undefined);
    } catch {
      // No clipboard access: the label still tells the user what to paste.
    }
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setCopied(false);
    }, COPIED_MS);
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
    const text = `Claude is already working on ${runningId ?? ''}`.trim();
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
    return (
      <>
        <span className={s.runNote}>Claude Code not found</span>
        <button type="button" className={s.copy} data-copied={copied} onClick={copy}>
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
