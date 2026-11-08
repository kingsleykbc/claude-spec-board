import { useEffect, useRef } from 'react';

// Esc closes the innermost layer only (pinned behaviour 14):
// dialog → reference add menu → category input → open menus → modal.
// Each open layer registers here; one document listener calls the top one.

export const ESC = { modal: 0, menu: 10, input: 20, refAdd: 30, dialog: 40 } as const;

interface Entry {
  priority: number;
  seq: number;
  run: () => void;
}

const entries = new Set<Entry>();
let seq = 0;

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  let top: Entry | null = null;
  for (const x of entries) if (!top || x.priority > top.priority || (x.priority === top.priority && x.seq > top.seq)) top = x;
  if (!top) return;
  e.preventDefault();
  top.run();
}

/** While `active`, Esc calls `handler` unless a layer with a higher priority (or a newer one at the same priority) is open. */
export function useEscape(active: boolean, handler: () => void, priority: number): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const entry: Entry = { priority, seq: ++seq, run: () => ref.current() };
    if (entries.size === 0) document.addEventListener('keydown', onKey);
    entries.add(entry);
    return () => {
      entries.delete(entry);
      if (entries.size === 0) document.removeEventListener('keydown', onKey);
    };
  }, [active, priority]);
}
