import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialSimple, saveSimple, SIMPLE_KEY } from './simpleMode';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Simple mode: the switch is remembered', () => {
  it('is off until turned on, and stays on for the next visit', () => {
    expect(initialSimple()).toBe(false);
    saveSimple(true);
    expect(localStorage.getItem(SIMPLE_KEY)).toBe('on');
    expect(initialSimple()).toBe(true);
    saveSimple(false);
    expect(initialSimple()).toBe(false);
  });

  it('blocked storage means off, and saving does not throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(initialSimple()).toBe(false);
    expect(() => saveSimple(true)).not.toThrow();
  });
});
