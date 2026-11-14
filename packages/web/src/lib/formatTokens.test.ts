import { describe, expect, it } from 'vitest';
import { formatTokens } from './formatTokens';

// The same cases as the server's formatTokens (packages/server/test/runs.test.ts).
describe('formatTokens', () => {
  it('formats like the server: plain, k, M, keeping .0', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(48210)).toBe('48.2k');
    expect(formatTokens(1300000)).toBe('1.3M');
    expect(formatTokens(999990)).toBe('1.0M');
    expect(formatTokens(1000)).toBe('1.0k');
  });
});
