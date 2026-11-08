import { describe, expect, it } from 'vitest';
import { shouldRewriteOrigin } from './devProxy';

describe('shouldRewriteOrigin (Vite dev proxy)', () => {
  it('rewrites when Origin is absent', () => {
    expect(shouldRewriteOrigin(undefined, 5173)).toBe(true);
    expect(shouldRewriteOrigin('', 5173)).toBe(true);
  });

  it("rewrites the dev server's own origin on localhost or 127.0.0.1", () => {
    expect(shouldRewriteOrigin('http://localhost:5173', 5173)).toBe(true);
    expect(shouldRewriteOrigin('http://127.0.0.1:5173', 5173)).toBe(true);
    expect(shouldRewriteOrigin('http://localhost:5199', 5199)).toBe(true);
  });

  it('forwards every other Origin unchanged so the server answers 403', () => {
    expect(shouldRewriteOrigin('http://evil.com', 5173)).toBe(false);
    expect(shouldRewriteOrigin('http://localhost:5174', 5173)).toBe(false);
    expect(shouldRewriteOrigin('https://localhost:5173', 5173)).toBe(false);
    expect(shouldRewriteOrigin('http://localhost:5173.evil.com', 5173)).toBe(false);
    expect(shouldRewriteOrigin('http://evil.localhost:5173', 5173)).toBe(false);
    expect(shouldRewriteOrigin('null', 5173)).toBe(false);
    expect(shouldRewriteOrigin('http://localhost', 5173)).toBe(false);
  });
});
