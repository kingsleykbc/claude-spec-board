import { describe, expect, it } from 'vitest';

// The M2 stub path is gone for good: nothing in the web package may name it. Spelled in pieces so this file does not match itself.
const sources = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const BANNED = [['CLAUDE', 'STUB', 'TOAST'].join('_'), 'ask' + 'Claude', 'api' + '.claude', 'client' + '.claude', 'next ' + 'milestone'];

describe('the M2 Claude stubs', () => {
  it.each(BANNED)('nothing refers to %s', (word) => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    const hits = Object.entries(sources)
      .filter(([, text]) => text.includes(word))
      .map(([path]) => path);
    expect(hits).toEqual([]);
  });
});
