const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const pad = (n: number) => String(n).padStart(2, '0');

/** Wall-clock milliseconds (local fields read as UTC), so a DST change never shifts a difference by an hour. */
const wall = (y: number, mo: number, d: number, h: number, mi: number, s: number) => Date.UTC(y, mo, d, h, mi, s);

/**
 * A log time for the logs list: "time ago" (`Intl.RelativeTimeFormat`) when under 30 days old, else
 * `YYYY-MM-DD HH:mm` local. `exact` is always `YYYY-MM-DD HH:mm`, for the tooltip, and `dateTime` is the
 * value for a `<time>` element. A future time (clock skew) is "just now". A time that can't be read (wrong
 * shape, trailing text, an impossible date like 2026-13-45) is shown as it is, with no `dateTime`.
 */
export function formatLogTime(at: string, now: Date): { label: string; exact: string; dateTime?: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/.exec(at.trim());
  if (!m) return { label: at, exact: at };
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? '0', m[5] ?? '0', m[6] ?? '0'].map(Number) as [number, number, number, number, number, number];
  const t = new Date(wall(y, mo - 1, d, h, mi, s));
  // Date.UTC rolls an impossible date over (Feb 30 becomes Mar 2); a real one reads back unchanged.
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) return { label: at, exact: at };
  const exact = `${m[1]}-${m[2]}-${m[3]} ${pad(h)}:${pad(mi)}`;
  const dateTime = exact.replace(' ', 'T');
  const diff = wall(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()) - t.getTime();
  if (diff >= 30 * DAY) return { label: exact, exact, dateTime };
  if (diff < MIN) return { label: 'just now', exact, dateTime };
  if (diff < HOUR) return { label: rtf.format(-Math.floor(diff / MIN), 'minute'), exact, dateTime };
  if (diff < DAY) return { label: rtf.format(-Math.floor(diff / HOUR), 'hour'), exact, dateTime };
  return { label: rtf.format(-Math.floor(diff / DAY), 'day'), exact, dateTime };
}
