import { useEffect, useRef } from 'react';

// Browser Back/Forward (popstate) guard for unsaved work (F3b).
// A view with unsaved work registers a handler; App's popstate listener calls `interceptPop` first.
// When a handler is registered, App puts the URL back and the handler asks before calling `leave`.

type Handler = (leave: () => void) => void;

const stack: Array<{ run: Handler }> = [];

/** While `active`, a popstate is handed to `handler` (the newest registration wins) instead of navigating. */
export function usePopGuard(active: boolean, handler: Handler): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const entry = { run: (leave: () => void) => ref.current(leave) };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** Called on popstate. Returns true when a guard took it (it calls `leave` if the user discards). */
export function interceptPop(leave: () => void): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.run(leave);
  return true;
}

/** While `active`, closing or reloading the tab asks the browser's "Leave site?" question (F3e). */
export function useBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent | Event) => {
      e.preventDefault();
      // Older browsers need returnValue set.
      (e as BeforeUnloadEvent).returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}
