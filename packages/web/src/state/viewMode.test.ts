import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialView, saveView, VIEW_KEY } from './viewMode';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('view mode', () => {
  it('is Board until Table is saved, and stays as saved', () => {
    expect(VIEW_KEY).toBe('specboard.view');
    expect(initialView()).toBe('board');
    saveView('table');
    expect(localStorage.getItem(VIEW_KEY)).toBe('table');
    expect(initialView()).toBe('table');
    saveView('board');
    expect(initialView()).toBe('board');
  });

  it('an unknown saved value or blocked storage means Board, and saving does not throw', () => {
    localStorage.setItem(VIEW_KEY, 'grid');
    expect(initialView()).toBe('board');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(initialView()).toBe('board');
    expect(() => saveView('table')).not.toThrow();
  });
});
