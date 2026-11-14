import { useSyncExternalStore } from 'react';
import { api } from '../api/client';

// Whether the board is served by the Claude Code plugin (its bundle) or from the Spec Board repo. The server says so
// once, in /api/health; until it answers, the board assumes the repo. Hints pick their wording from this.

let plugin = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export const isPluginMode = (): boolean => plugin;

export function setPluginMode(next: boolean): void {
  if (next === plugin) return;
  plugin = next;
  for (const l of listeners) l();
}

/** Asks the server once per page; a failure leaves the repo wording. */
export function loadMode(): Promise<void> {
  loading ??= Promise.resolve()
    .then(() => api.health())
    .then(
      (h) => setPluginMode(h?.plugin === true),
      () => undefined,
    );
  return loading;
}

/** For tests: forget the answer. */
export function resetMode(): void {
  loading = null;
  setPluginMode(false);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The mode, re-rendering when the server's answer arrives. */
export function usePluginMode(): boolean {
  return useSyncExternalStore(subscribe, isPluginMode, isPluginMode);
}
