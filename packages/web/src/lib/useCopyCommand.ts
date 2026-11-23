import { useCallback, useEffect, useRef, useState } from 'react';

export const COPIED_MS = 2600;
/** How long "Copy failed: paste …" stays, so the command can be selected by hand. */
export const COPY_FAILED_MS = 6000;

/**
 * Copies `command` to the clipboard and reports it: `copied` once the browser confirms, `failed` when it can't.
 * Each state resets by itself. The one place a "copy this command" button gets its behaviour.
 */
export function useCopyCommand(command: string): { state: 'idle' | 'copied' | 'failed'; copy: () => void } {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const show = useCallback((next: 'copied' | 'failed') => {
    if (!alive.current) return;
    setState(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        setState('idle');
      },
      next === 'copied' ? COPIED_MS : COPY_FAILED_MS,
    );
  }, []);

  const copy = useCallback(() => {
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
  }, [command, show]);

  return { state, copy };
}
