import { createContext, useContext } from 'react';

// Simple mode: the board shows only what you need to follow the work. Urgency, categories, dependencies,
// statuses and the "waiting on you" counts move behind ⋯ menus. One choice for every project, kept in this browser.

/** localStorage key for the Simple mode switch. */
export const SIMPLE_KEY = 'specboard.simple';

/** The saved choice; off when nothing is saved or storage is blocked. */
export function initialSimple(): boolean {
  try {
    return localStorage.getItem(SIMPLE_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Save the choice. Storage can throw; the choice then lasts for this page only. */
export function saveSimple(on: boolean): void {
  try {
    localStorage.setItem(SIMPLE_KEY, on ? 'on' : 'off');
  } catch {
    // storage blocked
  }
}

const SimpleContext = createContext(false);

/** Wrap the board in this with the current choice. Off when there is no provider (stories, tests). */
export const SimpleMode = SimpleContext.Provider;

export function useSimple(): boolean {
  return useContext(SimpleContext);
}
