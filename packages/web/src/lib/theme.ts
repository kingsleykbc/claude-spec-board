export type Theme = 'light' | 'dark';

/** localStorage key for the theme toggle (plan behaviour 20). */
export const THEME_KEY = 'specboard.theme';

/** Saved choice, else `prefers-color-scheme`. Storage access can throw; it is never required. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage blocked: fall through
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Set `data-theme` on <html>; with `remember`, also save the choice. */
export function applyTheme(t: Theme, remember = false): void {
  document.documentElement.dataset.theme = t;
  if (!remember) return;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}
