import { useCallback, useEffect, useState, type KeyboardEvent, type RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

export interface FocusTrapOptions {
  /** What gets focus on open: the container itself (default) or its first focusable element. */
  initial?: 'container' | 'first';
  /** Where focus goes on close when the element focused before opening is gone. */
  returnFocus?: () => HTMLElement | null;
}

/**
 * Keeps Tab inside `ref` (spread the returned handler as `onKeyDown`), focuses it on mount (unless an
 * `autoFocus` child already took focus) and,
 * on unmount, returns focus to whatever had it before — or, if that left the page, to
 * `returnFocus()`, or to the nearest other open modal.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, { initial = 'container', returnFocus }: FocusTrapOptions = {}) {
  // Read during the first render, before any `autoFocus` child moves focus on commit.
  const [prev] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(() => {
    const root = ref.current;
    if (root && !(document.activeElement instanceof Node && root.contains(document.activeElement))) {
      const target = initial === 'first' ? (focusables(root)[0] ?? root) : root;
      target.focus();
    }
    return () => {
      if (prev && prev.isConnected && prev !== document.body) {
        prev.focus();
        return;
      }
      const fallback =
        returnFocus?.() ??
        [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter((el) => el !== root && el.isConnected).pop() ??
        null;
      fallback?.focus();
    };
    // Mount/unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Tab') return;
      const root = ref.current;
      if (!root) return;
      e.stopPropagation();
      const list = focusables(root);
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      const inside = active instanceof Node && root.contains(active);
      if (e.shiftKey && (!inside || active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    },
    [ref],
  );
}
