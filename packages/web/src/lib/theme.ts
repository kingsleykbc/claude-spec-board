import { useCallback, useEffect, useState } from 'react';

/** The theme on screen. */
export type Theme = 'light' | 'dark';
/** What the person picked in Theme ▸ Light / Dark / System. System follows the OS setting live. */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** localStorage key for the theme choice (plan behaviour 20): `light`, `dark` or `system`. */
export const THEME_KEY = 'specboard.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const hasMatchMedia = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** The saved choice, or `system` when nothing (or something unknown) is saved, or storage throws. */
export function savedThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // storage blocked: fall through
  }
  return 'system';
}

/** The theme a choice shows: System reads `prefers-color-scheme` (light without matchMedia). */
export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== 'system') return choice;
  return hasMatchMedia() && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** Set `data-theme` on <html> for a choice; with `remember`, also save the choice. */
export function applyThemeChoice(choice: ThemeChoice, remember = false): void {
  document.documentElement.dataset.theme = resolveTheme(choice);
  if (!remember) return;
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

/** Calls `onChange` when the OS switches between light and dark; returns the unsubscribe. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => undefined;
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener?.('change', onChange);
  return () => mq.removeEventListener?.('change', onChange);
}

/**
 * The page's theme choice, kept in state: picking one applies and saves it, and while it is System an
 * OS change re-applies the theme.
 */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(savedThemeChoice);
  useEffect(() => {
    if (choice !== 'system') return;
    return watchSystemTheme(() => applyThemeChoice('system'));
  }, [choice]);
  const pick = useCallback((next: ThemeChoice) => {
    applyThemeChoice(next, true);
    setChoice(next);
  }, []);
  return [choice, pick];
}
