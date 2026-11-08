import { useCallback, useEffect, useRef, useState } from 'react';

// Toasts (pinned behaviour 12): bottom-left, at most 4, each dismissed after 4.5 s.

export type ToastKind = 'ok' | 'run' | 'info' | 'warn' | 'err';
export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  sub?: string;
}
export type PushToast = (kind: ToastKind, text: string, sub?: string) => void;

export const TOAST_MS = 4500;
export const MAX_TOASTS = 4;

/** Icon and colours per kind (prototype line 508). */
export const TOAST: Record<ToastKind, { icon: string; bg: string; fg: string }> = {
  ok: { icon: '✓', bg: 'var(--done-soft)', fg: 'var(--done-ink)' },
  run: { icon: '▶', bg: 'var(--accent-soft)', fg: 'var(--accent-ink)' },
  info: { icon: '●', bg: 'var(--doing-soft)', fg: 'var(--doing-ink)' },
  warn: { icon: '?', bg: 'var(--review-soft)', fg: 'var(--review-ink)' },
  err: { icon: '!', bg: 'var(--block-soft)', fg: 'var(--block-ink)' },
};

export function useToasts(): { toasts: Toast[]; push: PushToast; dismiss: (id: number) => void } {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) clearTimeout(t);
    timers.current.delete(id);
    setToasts((ts) => ts.filter((x) => x.id !== id));
  }, []);

  const push = useCallback<PushToast>(
    (kind, text, sub) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts.slice(-(MAX_TOASTS - 1)), sub === undefined ? { id, kind, text } : { id, kind, text, sub }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}
