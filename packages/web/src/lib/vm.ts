import type { Spec, Status, Urgency } from '@specboard/core';

// View-model helpers copied from the prototype (docs/design/Spec Board.dc.html, lines 495-509).

export interface StatusMeta {
  label: string;
  icon: string;
  ink: string;
  soft: string;
}

export const ST: Record<Status, StatusMeta> = {
  todo: { label: 'To-do', icon: '○', ink: 'var(--fg2)', soft: 'var(--panel)' },
  doing: { label: 'Doing', icon: '◐', ink: 'var(--doing-ink)', soft: 'var(--doing-soft)' },
  review: { label: 'Review', icon: '◆', ink: 'var(--review-ink)', soft: 'var(--review-soft)' },
  done: { label: 'Done', icon: '✓', ink: 'var(--done-ink)', soft: 'var(--done-soft)' },
};
export const ORDER: Status[] = ['todo', 'doing', 'review', 'done'];

export const URG: Record<Urgency, { r: number; label: string; n: number }> = {
  urgent: { r: 0, label: 'Urgent', n: 3 },
  high: { r: 1, label: 'High', n: 3 },
  normal: { r: 2, label: 'Normal', n: 2 },
  low: { r: 3, label: 'Low', n: 1 },
};
export const URG_KEYS: Urgency[] = ['low', 'normal', 'high', 'urgent'];

/** Run-log line kinds: [icon, colour]. */
export const LINE: Record<string, [string, string]> = {
  start: ['▶', 'var(--accent)'],
  read: ['◇', 'var(--fg3)'],
  edit: ['✎', 'var(--fg2)'],
  cmd: ['›', 'var(--fg2)'],
  ok: ['✓', 'var(--done-ink)'],
  done: ['✓', 'var(--done-ink)'],
  stop: ['■', 'var(--fg2)'],
  warn: ['?', 'var(--review-ink)'],
  err: ['!', 'var(--block-ink)'],
};

export interface UrgVm {
  key: Urgency;
  label: string;
  bars: { h: string; c: string }[];
  fg: string;
  weight: number;
  bg: string;
  pad: string;
}

export function urgVm(k: Urgency): UrgVm {
  const u = URG[k];
  const col = k === 'urgent' ? 'var(--accent)' : k === 'high' ? 'var(--fg2)' : 'var(--fg3)';
  return {
    key: k,
    label: u.label,
    bars: [5, 8, 11].map((h, i) => ({ h: h + 'px', c: i < u.n ? col : 'var(--line2)' })),
    fg: k === 'urgent' ? 'var(--accent-ink)' : k === 'high' ? 'var(--fg)' : 'var(--fg3)',
    weight: k === 'urgent' || k === 'high' ? 600 : 500,
    bg: k === 'urgent' ? 'var(--accent-soft)' : 'transparent',
    pad: k === 'urgent' ? '2px 7px 2px 6px' : '2px 0',
  };
}

function hue(n: string): number {
  let h = 0;
  for (const ch of n.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.round((h * 137.508) % 360);
}

/** Category dot colour (the prototype's `catVm(n).dot`). */
export function catColor(name: string): string {
  return `oklch(0.66 0.14 ${hue(name)})`;
}

export function statusMeta(s: Status): StatusMeta {
  return ST[s];
}

/** First paragraph of Markdown (headings skipped), wrapped lines joined with spaces. */
export function firstParagraph(md: string): string {
  for (const block of md.split(/\r?\n\s*\r?\n/)) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '' && !/^#{1,6}\s/.test(l));
    if (lines.length > 0) return lines.join(' ');
  }
  return '';
}

/** Cut to `max` characters, the last being `…`. */
export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STAMP = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/** `2026-11-07 15:12` (or `T`, or with seconds) → `Nov 7, 15:12`. Unparseable input is returned as is. */
export function fmtLogTime(s: string): string {
  const m = STAMP.exec(s.trim());
  if (!m || m[4] === undefined) return s;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return s;
  return `${month} ${Number(m[3])}, ${m[4]}:${m[5]}`;
}

/** Parse a local `YYYY-MM-DD[ T]HH:MM[:SS]` stamp. */
function parseLocal(s: string): Date | null {
  const m = STAMP.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `just now`, `15m ago`, `2h ago`, `2d ago`, then `Sep 1`. Empty for missing or unparseable input. */
export function relTime(s: string | null | undefined, now: Date = new Date()): string {
  if (!s) return '';
  const d = parseLocal(s);
  if (!d) return '';
  const sec = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 30 * 86400) return `${Math.floor(sec / 86400)}d ago`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** A path shown to the user: relative to the project root, with forward slashes (as is when outside the root). */
export function relPath(root: string, p: string): string {
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '');
  const r = norm(root);
  const f = norm(p);
  if (r !== '' && f.toLowerCase().startsWith(r.toLowerCase() + '/')) return f.slice(r.length + 1);
  return f;
}

export interface BlockText {
  key: string;
  text: string;
  section: 'questions' | 'dependencies';
}

/** The reasons a spec is blocked, as its banner words them (pinned behaviour 8). `all` includes archived specs. */
export function blockTexts(spec: Spec, all: Spec[]): BlockText[] {
  const reasons: BlockText[] = [];
  const open = spec.questions.filter((q) => q.answer === null || q.answer === '');
  if (open.length > 0) {
    reasons.push({ key: 'q', text: `Awaiting answers on: ${open.map((q) => truncate(q.text, 40)).join(', ')}`, section: 'questions' });
  }
  for (const dep of spec.dependsOn) {
    const d = all.find((x) => x.id === dep);
    let text: string;
    if (dep === spec.id) text = 'Depends on itself';
    else if (!d) text = `${dep} not found`;
    else if (!d.archived && d.status !== 'done') text = `Waiting on ${d.id} ${d.title} (${ST[d.status].label})`;
    else continue;
    reasons.push({ key: `dep:${dep}`, text, section: 'dependencies' });
  }
  return reasons;
}

/** Why Run shouldn't start this spec yet, or null. Only the board holds back: the server would still start it. */
export function runHold(spec: Spec, all: Spec[]): string | null {
  if (spec.draft) return 'Draft. Have Claude write this up first.';
  const first = blockTexts(spec, all)[0];
  return first ? `Blocked. ${first.text}` : null;
}
