import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins conditional classes', () => {
    expect(cn('a', false && 'b', null, undefined, { c: true, d: false }, ['e'])).toBe('a c e');
  });

  it('lets a later token colour win over an earlier one', () => {
    expect(cn('bg-card text-fg', 'bg-raise')).toBe('text-fg bg-raise');
    expect(cn('border-line', 'border-line2')).toBe('border-line2');
  });

  it('keeps a text size beside a token text colour', () => {
    expect(cn('text-sm', 'text-fg2')).toBe('text-sm text-fg2');
    expect(cn('text-accent-ink', 'text-xs')).toBe('text-accent-ink text-xs');
  });
});
