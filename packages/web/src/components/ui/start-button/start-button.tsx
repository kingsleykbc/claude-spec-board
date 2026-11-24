import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type Ref } from 'react';
import { Spinner } from '@/components/connection-banner/connection-banner';

/**
 * What a button that starts Claude calls. It may return a promise that settles once the run has started or the start
 * failed (the board's `startRun`); the button says Starting… until then.
 */
export type StartHandler = () => unknown;

/** The words a starting button shows beside its spinner. */
export const STARTING = 'Starting…';

/**
 * The shared "Starting…" state of every button that starts a background run. `start` calls `onStart` once and holds
 * `starting` until what it returned settles; a second call meanwhile does nothing, so a double click starts one run.
 */
export function useStarting(onStart: StartHandler | undefined): { starting: boolean; start: () => void } {
  const [starting, setStarting] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(() => {
    if (busy.current || !onStart) return;
    busy.current = true;
    setStarting(true);
    const done = () => {
      busy.current = false;
      if (mounted.current) setStarting(false);
    };
    let result: unknown;
    try {
      result = onStart();
    } catch (e) {
      done();
      throw e;
    }
    Promise.resolve(result).then(done, done);
  }, [onStart]);

  return { starting, start };
}

/** A spinner and "Starting…", for a button whose start is in flight. */
export function StartingLabel() {
  return (
    <>
      <Spinner />
      {STARTING}
    </>
  );
}

export interface StartButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Starts the run; see `StartHandler`. Undefined: a click does nothing (Claude's status isn't known yet). */
  onStart: StartHandler | undefined;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A button that starts Claude. The moment it is clicked it shows a spinner and "Starting…" and is disabled, until the
 * run has started (the caller's running UI then takes over) or the start failed (the button comes back; the caller
 * shows the error). While starting, its name is "Starting…" too, so a screen reader hears what is on screen.
 * Other props go on the `<button>`, so it can sit inside a `Hint` or another `asChild` trigger.
 */
export function StartButton({ onStart, onClick, children, disabled, 'aria-label': label, ...rest }: StartButtonProps) {
  const { starting, start } = useStarting(onStart);
  return (
    <button
      type="button"
      {...rest}
      aria-label={starting ? undefined : label}
      aria-busy={starting || undefined}
      disabled={starting || disabled}
      data-starting={starting || undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) start();
      }}
    >
      {starting ? <StartingLabel /> : children}
    </button>
  );
}
