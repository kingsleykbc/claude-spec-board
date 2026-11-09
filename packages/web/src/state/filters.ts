import type { Question, Spec, Urgency } from '@specboard/core';
import { URG } from '../lib/vm';

// Board filters, sort and "waiting" items (pinned behaviours 1, 3, 4), copied from the prototype's renderVals.

export interface Filters {
  cats: string[];
  urg: Urgency[];
  blocked: boolean;
}
export const NO_FILTERS: Filters = { cats: [], urg: [], blocked: false };

/** Category and Urgency combine with AND across groups and OR within a group; Blocked only is a switch. */
export function filterSpecs(specs: Spec[], f: Filters): Spec[] {
  return specs.filter(
    (s) =>
      (f.cats.length === 0 || s.categories.some((c) => f.cats.includes(c))) &&
      (f.urg.length === 0 || f.urg.includes(s.urgency)) &&
      (!f.blocked || s.blocked),
  );
}

/** Urgency (urgent, high, normal, low), then numeric ID. */
export function compareSpecs(a: Spec, b: Spec): number {
  return URG[a.urgency].r - URG[b.urgency].r || a.id.localeCompare(b.id, undefined, { numeric: true });
}

/** A sorted copy. */
export function sortSpecs(specs: Spec[]): Spec[] {
  return [...specs].sort(compareSpecs);
}

/** The questions waiting on the person. An unanswered optional one isn't: Claude goes with its recommendation. */
export function openQuestions(s: Spec): Question[] {
  return s.questions.filter((q) => q.required && (q.answer === null || q.answer === ''));
}

export interface WaitItem {
  kind: 'review' | 'questions' | 'blocked';
  text: string;
  /** The spec to open (review, questions); null for blocked, which toggles the filter. */
  target: string | null;
}

/** "<n> to review", "<n> question(s) for you", "<n> blocked"; each hidden when 0. Archived specs are ignored. */
export function waitItems(specs: Spec[]): WaitItem[] {
  const live = specs.filter((s) => !s.archived);
  const review = live.filter((s) => s.status === 'review');
  const qN = live.reduce((n, s) => n + openQuestions(s).length, 0);
  const firstQ = live.find((s) => openQuestions(s).length > 0);
  const blockedN = live.filter((s) => s.status !== 'done' && s.blocked).length;
  const out: WaitItem[] = [];
  if (review.length) out.push({ kind: 'review', text: `${review.length} to review`, target: review[0]!.id });
  if (qN) out.push({ kind: 'questions', text: `${qN} question${qN > 1 ? 's' : ''} for you`, target: firstQ?.id ?? null });
  if (blockedN) out.push({ kind: 'blocked', text: `${blockedN} blocked`, target: null });
  return out;
}

/** Every category in the project (first-seen order), with how many live specs carry it. */
export function categoryOptions(live: Spec[], archived: Spec[]): { name: string; n: number }[] {
  const names = [...new Set([...live, ...archived].flatMap((s) => s.categories))];
  return names.map((name) => ({ name, n: live.filter((s) => s.categories.includes(name)).length }));
}

export interface FilterChip {
  prefix: string;
  label: string;
  /** The filters with this chip removed. */
  without: Filters;
}

export function filterChips(f: Filters): FilterChip[] {
  return [
    ...f.cats.map((c) => ({ prefix: 'Category', label: c, without: { ...f, cats: f.cats.filter((y) => y !== c) } })),
    ...f.urg.map((u) => ({ prefix: 'Urgency', label: URG[u].label, without: { ...f, urg: f.urg.filter((y) => y !== u) } })),
    ...(f.blocked ? [{ prefix: '', label: 'Blocked only', without: { ...f, blocked: false } }] : []),
  ];
}

export function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
