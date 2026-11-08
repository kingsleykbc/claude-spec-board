import { describe, expect, it } from 'vitest';
import { catColor, firstParagraph, fmtLogTime, relTime, statusMeta, truncate, urgVm } from './vm';

// The prototype's hue(), copied as-is, to pin catColor to it.
const hue = (n: string) => {
  let h = 0;
  for (const ch of n.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.round((h * 137.508) % 360);
};

describe('vm', () => {
  it('catColor reproduces the prototype formula', () => {
    expect(catColor('Frontend')).toBe(`oklch(0.66 0.14 ${hue('Frontend')})`);
    expect(catColor('backend')).toBe(catColor('Backend'));
  });

  it('urgVm matches the prototype', () => {
    const filled = (k: Parameters<typeof urgVm>[0]) => urgVm(k).bars.filter((b) => b.c !== 'var(--line2)').length;
    expect(filled('normal')).toBe(2);
    expect(filled('urgent')).toBe(3);
    expect(filled('high')).toBe(3);
    expect(filled('low')).toBe(1);
    expect(urgVm('normal').bars.map((b) => b.h)).toEqual(['5px', '8px', '11px']);
    expect(urgVm('urgent')).toEqual({
      key: 'urgent',
      label: 'Urgent',
      bars: [
        { h: '5px', c: 'var(--accent)' },
        { h: '8px', c: 'var(--accent)' },
        { h: '11px', c: 'var(--accent)' },
      ],
      fg: 'var(--accent-ink)',
      weight: 600,
      bg: 'var(--accent-soft)',
      pad: '2px 7px 2px 6px',
    });
    expect(urgVm('low')).toMatchObject({ fg: 'var(--fg3)', weight: 500, bg: 'transparent', pad: '2px 0' });
    expect(urgVm('high').bars[0]!.c).toBe('var(--fg2)');
  });

  it('statusMeta copies ST', () => {
    expect(statusMeta('review')).toEqual({ label: 'Review', icon: '◆', ink: 'var(--review-ink)', soft: 'var(--review-soft)' });
    expect(statusMeta('todo').icon).toBe('○');
  });

  it('fmtLogTime', () => {
    expect(fmtLogTime('2026-11-07 15:12')).toBe('Nov 7, 15:12');
    expect(fmtLogTime('2026-11-07T15:12')).toBe('Nov 7, 15:12');
    expect(fmtLogTime('2026-01-30T09:05:59')).toBe('Jan 30, 09:05');
    expect(fmtLogTime('2026-12-01 23:59:00')).toBe('Dec 1, 23:59');
    expect(fmtLogTime('garbage')).toBe('garbage');
  });

  it('truncate', () => {
    const q = 'Should the export include quantities?';
    expect(truncate(q, 40)).toBe(q);
    const out = truncate('x'.repeat(50), 40);
    expect(out.endsWith('…')).toBe(true);
    expect(out).toHaveLength(40);
  });

  it('firstParagraph skips headings and joins wrapped lines', () => {
    expect(firstParagraph('Combine the ingredients\ninto one list.\n\n## Features\n- a')).toBe('Combine the ingredients into one list.');
    expect(firstParagraph('\r\n\r\n# Title\r\n\r\nBody here.')).toBe('Body here.');
    expect(firstParagraph('')).toBe('');
  });

  it('relTime', () => {
    const now = new Date(2026, 10, 8, 12, 0);
    expect(relTime('2026-11-08T11:59:40', now)).toBe('just now');
    expect(relTime('2026-11-08T11:45', now)).toBe('15m ago');
    expect(relTime('2026-11-08T09:30', now)).toBe('2h ago');
    expect(relTime('2026-11-06 12:00', now)).toBe('2d ago');
    expect(relTime('2026-09-01', now)).toBe('Sep 1');
    expect(relTime(null, now)).toBe('');
  });
});
