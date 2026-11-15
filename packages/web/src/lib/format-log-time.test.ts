import { describe, expect, it } from 'vitest';
import { formatLogTime } from './format-log-time';

const now = new Date(2026, 10, 14, 12, 0);
const label = (at: string) => formatLogTime(at, now).label;

describe('formatLogTime', () => {
  it('shows recent times as time ago', () => {
    expect(label('2026-11-14 11:59')).toBe('1 minute ago');
    expect(label('2026-11-14 09:00')).toBe('3 hours ago');
    expect(label('2026-11-13 12:00')).toBe('yesterday');
    expect(label('2026-11-11T12:00')).toBe('3 days ago');
  });

  it('under a minute is just now', () => {
    expect(label('2026-11-14 11:59:30')).toBe('just now');
    expect(label('2026-11-14 12:00')).toBe('just now');
  });

  it('29 days is still relative; exactly 30 days is the date and time', () => {
    expect(label('2026-10-16 12:00')).toBe('29 days ago');
    expect(label('2026-10-15 12:00')).toBe('2026-10-15 12:00');
    expect(label('2025-01-02 08:05')).toBe('2025-01-02 08:05');
  });

  it('a future time (clock skew) is just now', () => {
    expect(label('2026-11-15 09:00')).toBe('just now');
  });

  it('exact is always YYYY-MM-DD HH:mm', () => {
    expect(formatLogTime('2026-11-14 11:59', now).exact).toBe('2026-11-14 11:59');
    expect(formatLogTime('2026-11-07T09:05:59', now).exact).toBe('2026-11-07 09:05');
  });

  it('gives a machine-readable dateTime only when the time parsed', () => {
    expect(formatLogTime('2026-11-14 11:59', now).dateTime).toBe('2026-11-14T11:59');
    expect(formatLogTime('2026-11-14T11:59:30.250', now)).toMatchObject({ label: 'just now', exact: '2026-11-14 11:59' });
    expect(formatLogTime('garbage', now).dateTime).toBeUndefined();
  });

  it('impossible dates and trailing junk are shown raw', () => {
    for (const raw of ['2026-13-45 10:00', '2026-02-30', '2026-11-14 24:00', '2026-11-14 10:61', '2026-11-14 10:00 junk', '2026-11-14 10:00Z'])
      expect(formatLogTime(raw, now)).toEqual({ label: raw, exact: raw });
  });

  it('an unparseable time is shown raw', () => {
    expect(formatLogTime('garbage', now)).toEqual({ label: 'garbage', exact: 'garbage' });
    expect(formatLogTime('', now)).toEqual({ label: '', exact: '' });
  });
});
