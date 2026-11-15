import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { applyThemeChoice, resolveTheme, savedThemeChoice, THEME_KEY, useThemeChoice, watchSystemTheme } from './theme';

/** A fake `prefers-color-scheme` the test can flip; returns the flip. */
function fakeOs(dark: boolean) {
  const listeners = new Set<() => void>();
  const mq = {
    get matches() {
      return dark;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal('matchMedia', vi.fn((q: string) => (q.includes('prefers-color-scheme') ? mq : { matches: false, media: q, addEventListener() {}, removeEventListener() {} })));
  return {
    set(next: boolean) {
      dark = next;
      for (const fn of [...listeners]) fn();
    },
    listeners,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('theme choice', () => {
  it('defaults to system when nothing is saved, or the value is unknown', () => {
    expect(savedThemeChoice()).toBe('system');
    localStorage.setItem(THEME_KEY, 'purple');
    expect(savedThemeChoice()).toBe('system');
  });

  it('returns system when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(savedThemeChoice()).toBe('system');
  });

  it('still loads the old saved values light and dark, and the new system', () => {
    for (const v of ['light', 'dark', 'system'] as const) {
      localStorage.setItem(THEME_KEY, v);
      expect(savedThemeChoice()).toBe(v);
    }
  });

  it('resolves system from the OS setting, and light/dark as themselves', () => {
    const os = fakeOs(true);
    expect(resolveTheme('system')).toBe('dark');
    os.set(false);
    expect(resolveTheme('system')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('without matchMedia, system is light', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme('system')).toBe('light');
    expect(() => watchSystemTheme(() => undefined)()).not.toThrow();
  });

  it('applies the theme, and saves the choice only when asked; a blocked save does not throw', () => {
    fakeOs(false);
    applyThemeChoice('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    applyThemeChoice('system', true);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('system');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => applyThemeChoice('dark', true)).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('with system, an OS change flips data-theme while watched; unwatching stops it', () => {
    const os = fakeOs(false);
    applyThemeChoice('system');
    expect(document.documentElement.dataset.theme).toBe('light');
    const stop = watchSystemTheme(() => applyThemeChoice('system'));
    os.set(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    os.set(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    stop();
    expect(os.listeners.size).toBe(0);
    os.set(true);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('falls back to addListener/removeListener when addEventListener is missing', () => {
    const listeners = new Set<() => void>();
    const mq = { matches: false, media: '', addListener: (fn: () => void) => listeners.add(fn), removeListener: (fn: () => void) => listeners.delete(fn) };
    vi.stubGlobal('matchMedia', vi.fn(() => mq));
    const onChange = vi.fn();
    const stop = watchSystemTheme(onChange);
    expect(listeners.size).toBe(1);
    for (const fn of listeners) fn();
    expect(onChange).toHaveBeenCalledOnce();
    stop();
    expect(listeners.size).toBe(0);
  });
});

describe('useThemeChoice', () => {
  it('starts on system and follows the OS; after picking Light, an OS change leaves the theme alone', () => {
    const os = fakeOs(false);
    applyThemeChoice(savedThemeChoice());
    const { result, unmount } = renderHook(() => useThemeChoice());
    expect(result.current[0]).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('light');
    act(() => os.set(true));
    expect(document.documentElement.dataset.theme).toBe('dark');

    act(() => result.current[1]('light'));
    expect(result.current[0]).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    act(() => os.set(false));
    act(() => os.set(true));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(os.listeners.size).toBe(0);
    unmount();
  });
});
