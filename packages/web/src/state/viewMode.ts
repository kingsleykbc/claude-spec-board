// Board or Table: one choice for every project, kept in this browser (like Simple mode).

export type View = 'board' | 'table';

/** localStorage key for the Board | Table switch. */
export const VIEW_KEY = 'specboard.view';

/** The saved choice; Board when nothing (or something unknown) is saved or storage is blocked. */
export function initialView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'board';
  } catch {
    return 'board';
  }
}

/** Save the choice. Storage can throw; the choice then lasts for this page only. */
export function saveView(v: View): void {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // storage blocked
  }
}
